import asyncio
import base64
import json
import os
import requests
import logging
import datetime
import aiohttp

from typing import AsyncIterator, Any, Dict, List, Mapping, Optional
from steel import Steel
from playwright.async_api import async_playwright, Page
from fastapi import HTTPException

from api.models import ModelConfig
from api.utils.types import AgentSettings
from langchain_core.messages import BaseMessage
from api.utils.prompt import chat_dict_to_base_messages
from dotenv import load_dotenv
from langchain_core.messages import ToolMessage
from langchain.schema import AIMessage

# Import from our new modules
from .tools import _execute_computer_action, _create_tools, _make_cua_content_for_role
from .prompts import SYSTEM_PROMPT
from .cursor_overlay import inject_cursor_overlay

load_dotenv(".env.local")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("openai_computer_use")

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"

# Default settings that can be overridden by agent_settings
DEFAULT_MAX_STEPS = 30
DEFAULT_WAIT_TIME_BETWEEN_STEPS = 1
DEFAULT_NUM_IMAGES_TO_KEEP = 10


def _create_tool_message(content: Any, tool_call_id: str, is_call: bool = True) -> ToolMessage:
    """
    Helper function to create consistently formatted tool messages.
    Args:
        content: The content of the tool message
        tool_call_id: The ID of the tool call
        is_call: True if this is a tool call, False if it's a tool result
    """
    if is_call:
        # For tool calls, create a message with tool_calls property
        return ToolMessage(
            content="",  # Empty content for tool calls
            tool_calls=[{
                "id": tool_call_id,
                "type": "function",
                "function": {
                    "name": content["name"],
                    "arguments": json.dumps(content["args"])
                }
            }],
            type="tool"
        )
    else:
        # For tool results, create a message with tool_call_id
        return ToolMessage(
            content=content,
            tool_call_id=tool_call_id,
            type="tool"
        )


async def openai_computer_use_agent(
    model_config: ModelConfig,
    agent_settings: AgentSettings,
    history: List[Mapping[str, Any]],
    session_id: str,
    cancel_event: Optional[asyncio.Event] = None,
) -> AsyncIterator[Any]:
    """
    OpenAI's computer-use-preview model integration.
    
    Args:
        model_config: Configuration for the model including:
            - model_name: The model to use (e.g. "computer-use-preview")
            - temperature: Model temperature
            - api_key: OpenAI API key
            - max_tokens: Maximum tokens to generate
        agent_settings: Agent-specific settings including:
            - system_prompt: Custom system prompt to use
            - max_steps: Maximum number of steps (default: 30)
            - wait_time_between_steps: Seconds to wait between actions (default: 1)
            - num_images_to_keep: Number of images to keep in context (default: 10)
        history: Chat history
        session_id: Steel session ID
        cancel_event: Optional event to cancel execution
    """
    logger.info(
        f"Starting OpenAI Computer Use agent with session_id: {session_id}")
    logger.info(f"Using model: {model_config.model_name}")

    # Extract settings from agent_settings with defaults
    max_steps = getattr(agent_settings, "max_steps", DEFAULT_MAX_STEPS)
    wait_time = getattr(agent_settings, "wait_time_between_steps", DEFAULT_WAIT_TIME_BETWEEN_STEPS)
    num_images = getattr(agent_settings, "num_images_to_keep", DEFAULT_NUM_IMAGES_TO_KEEP)

    # 1) Retrieve the Steel session
    STEEL_API_KEY = os.getenv("STEEL_API_KEY")
    STEEL_API_URL = os.getenv("STEEL_API_URL")
    STEEL_CONNECT_URL = os.getenv("STEEL_CONNECT_URL")

    logger.info("Connecting to Steel session...")
    client = Steel(steel_api_key=STEEL_API_KEY, base_url=STEEL_API_URL)
    try:
        session = client.sessions.retrieve(session_id)
        logger.info(f"Successfully connected to Steel session: {session.id}")
        logger.info(f"Session viewer URL: {session.session_viewer_url}")
    except Exception as e:
        logger.error(f"Failed to retrieve Steel session: {e}")
        raise HTTPException(
            status_code=400, detail=f"Failed to retrieve session: {e}")

    yield "[OPENAI-CUA] Session loaded. Connecting to remote browser..."

    # 2) Connect Playwright over cdp
    logger.info("Connecting Playwright to Steel session...")
    async with async_playwright() as p:
        try:
            # Attempt the CDP connection
            browser = await p.chromium.connect_over_cdp(
                f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session.id}"
            )
            yield "[OPENAI-CUA] Playwright connected!"
        except Exception as cdp_error:
            logger.error(f"Failed to connect Playwright over CDP: {cdp_error}")
            yield f"Error: could not connect to browser session (CDP) - {cdp_error}"
            return

        # If we got here, we have a browser handle
        contexts = browser.contexts
        if not contexts:
            logger.error("No contexts found in the Steel session browser")
            yield "Error: No contexts found in the remote browser"
            return

        page_list = contexts[0].pages
        if not page_list:
            # If no pages exist, create one
            page = contexts[0].new_page()
        else:
            page = page_list[0]

        logger.info("Successfully connected Playwright to Steel session")

        # Get the window size
        viewport_size = await page.evaluate("""() => ({
            width: window.innerWidth,
            height: window.innerHeight
        })""")
        logger.info(f"Got viewport size: {viewport_size}")

        # Set viewport using the window size
        await page.set_viewport_size(viewport_size)
        logger.info(f"Set viewport size to {viewport_size['width']}x{viewport_size['height']}")

        # Add cursor overlay to make mouse movements visible
        logger.info("Injecting cursor overlay script...")
        await inject_cursor_overlay(page)
        logger.info("Cursor overlay injected successfully")

        await page.goto("https://www.google.com")

        # Convert user history to base messages
        logger.info("Converting user history to base messages...")
        base_msgs: List[BaseMessage] = chat_dict_to_base_messages(history)
        logger.info(f"Converted {len(base_msgs)} messages from history")

        # Initialize conversation items array
        conversation_items: List[Dict[str, Any]] = []

        # Add system prompt as 'system' (-> input_text)
        logger.info("Adding system prompt to conversation")
        system_text = (
            SYSTEM_PROMPT
            + f"\nCurrent date/time: {datetime.datetime.now():%Y-%m-%d %H:%M:%S}"
        )
        conversation_items.append({
            "role": "system",
            "content": _make_cua_content_for_role("system", system_text)
        })

        # Process history messages
        logger.info("Processing history messages...")
        for m in base_msgs:
            # If it's a tool response, we treat it like 'computer_call_output'
            if hasattr(m, "tool_call_id"):
                logger.debug(
                    f"Processing tool response with call_id: {m.tool_call_id}")
                conversation_items.append({
                    "type": "computer_call_output",
                    "call_id": m.tool_call_id,
                    "output": {
                        "type": "input_image",
                        "image_url": (
                            m.content if isinstance(m.content, str)
                            else json.dumps(m.content)
                        )
                    }
                })
            elif m.type == "ai":
                # Assistant message => output_text
                text_content = (
                    m.content if isinstance(m.content, str)
                    else json.dumps(m.content)
                )
                conversation_items.append({
                    "role": "assistant",
                    "content": _make_cua_content_for_role("assistant", text_content)
                })
            else:
                # user or system => input_text
                user_text = (
                    m.content if isinstance(m.content, str)
                    else json.dumps(m.content)
                )
                conversation_items.append({
                    "role": "user",
                    "content": _make_cua_content_for_role("user", user_text)
                })
        logger.info(
            f"Processed {len(conversation_items)} total conversation items")

        # Create an extended tools array with new function calls
        tools = [
            {
                "type": "computer-preview",
                "display_width": viewport_size["width"],
                "display_height": viewport_size["height"],
                "environment": "browser",
            },
            {
                "type": "function",
                "name": "goto",
                "description": "Navigate to a specified URL.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "Destination URL to navigate to."
                        }
                    },
                    "required": ["url"]
                },
            },
            {
                "type": "function",
                "name": "back",
                "description": "Go back in browser history.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                },
            },
            {
                "type": "function",
                "name": "forward",
                "description": "Go forward in browser history.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                },
            },
            {
                "type": "function",
                "name": "change_url",
                "description": "Change the current URL to a new one.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "New URL to navigate to."
                        }
                    },
                    "required": ["url"]
                },
            }
        ]

        # Main loop with configurable max steps
        steps = 0
        while True:
            if cancel_event and cancel_event.is_set():
                logger.info("Cancel event detected, exiting agent loop")
                yield "[OPENAI-CUA] Cancel event detected, stopping..."
                break
            if steps > max_steps:
                logger.info(
                    f"Reached maximum steps ({max_steps}), exiting agent loop")
                yield f"[OPENAI-CUA] Reached max steps ({max_steps}), stopping..."
                break

            steps += 1
            logger.info(f"Starting step {steps}/{max_steps}")

            # 3) Call OpenAI /v1/responses endpoint
            logger.info("Preparing OpenAI API request...")
            openai_api_key = os.getenv(
                "OPENAI_API_KEY") or model_config.api_key
            if not openai_api_key:
                logger.error("No OpenAI API key configured")
                raise HTTPException(400, "No OPENAI_API_KEY configured")

            # Validate model name
            model_name = model_config.model_name or "computer-use-preview-2025-02-04"
            valid_models = ["computer-use-preview",
                            "computer-use-preview-2025-02-04"]
            if model_name not in valid_models:
                logger.error(
                    f"Invalid model name: {model_name}. Must be one of: {valid_models}")
                raise HTTPException(400, f"Invalid model name: {model_name}")

            headers = {
                "Authorization": f"Bearer {openai_api_key}",
                "Content-Type": "application/json",
                # Both header keys to ensure coverage
                "OpenAI-Beta": "responses=v1",
                "Openai-Beta": "responses=v1"
            }
            request_body = {
                "model": model_name,
                "input": conversation_items,
                "tools": tools,  # include both the environment + goto function
                "truncation": "auto"
            }

            try:
                logger.info("Sending request to OpenAI /v1/responses endpoint...")
                logger.debug(f"Request headers: {headers}")
                logger.debug(
                    f"Request body: {json.dumps(request_body, indent=2)}")

                # Create a task for the request with a timeout
                async def make_request():
                    async with aiohttp.ClientSession() as session:
                        async with session.post(
                            OPENAI_RESPONSES_URL,
                            json=request_body,
                            headers=headers,
                            timeout=aiohttp.ClientTimeout(total=120)
                        ) as resp:
                            if not resp.ok:
                                error_detail = ""
                                try:
                                    error_json = await resp.json()
                                    error_detail = json.dumps(error_json, indent=2)
                                except:
                                    error_detail = await resp.text()

                                logger.error(
                                    f"OpenAI API error response ({resp.status}):")
                                logger.error(f"Response headers: {dict(resp.headers)}")
                                logger.error(f"Response body: {error_detail}")
                                resp.raise_for_status()

                            return await resp.json()

                # Create the request task
                request_task = asyncio.create_task(make_request())

                # Wait for either the request to complete or cancellation
                done, _ = await asyncio.wait(
                    [request_task],
                    return_when=asyncio.FIRST_COMPLETED
                )

                # Check if we were cancelled
                if cancel_event and cancel_event.is_set():
                    request_task.cancel()
                    logger.info("Request cancelled due to cancel event")
                    yield "[OPENAI-CUA] Request cancelled..."
                    break

                # Get the result
                data = request_task.result()

            except asyncio.CancelledError:
                logger.info("Request was cancelled")
                yield "[OPENAI-CUA] Request cancelled..."
                break

            if "output" not in data:
                logger.error(f"No 'output' in response: {data}")
                yield f"No 'output' in /v1/responses result: {data}"
                break

            # 4) Process output items
            new_items = data["output"]
            logger.info(f"Received {len(new_items)} new items from OpenAI")
            conversation_items.extend(new_items)

            # Flag to track if we've received a final assistant message in this batch
            received_assistant = False

            for item in new_items:
                item_type = item.get("type")
                logger.debug(f"Processing item of type: {item_type}")

                if item_type == "message":
                    # It's a chunk of user or assistant text
                    text_segments = item["content"]
                    # The model uses "input_text" or "output_text"
                    # We'll combine them all just to display
                    full_text = "".join(seg["text"] for seg in text_segments if seg["type"] in [
                                        "input_text", "output_text"])
                    if full_text.strip():
                        logger.info(
                            f"Yielding message text: {full_text[:100]}...")
                        yield full_text

                elif item_type == "computer_call":
                    # The model wants us to do something (e.g. click, type, etc.)
                    call_id = item["call_id"]
                    action = item["action"]
                    ack_checks = item.get("pending_safety_checks", [])

                    # First yield the tool call with explicit type
                    tool_call_msg = {
                        "name": action["type"],
                        "args": action,
                        "id": call_id
                    }

                    logger.info(
                        f"[TOOL_CALL] Yielding computer action call: {action['type']} (id: {call_id})")

                    yield AIMessage(content="", tool_calls=[tool_call_msg])

                    # Log complete action details
                    action_details = json.dumps(action, indent=2)
                    logger.info(
                        f"Executing computer action (call_id: {call_id}):\n{action_details}")
                    if ack_checks:
                        logger.info(
                            f"Safety checks to acknowledge: {json.dumps(ack_checks, indent=2)}")

                    # Actually do the action and get screenshot
                    screenshot_b64 = await _execute_computer_action(page, action)
                    logger.info(f"Executed computer action successfully")

                    # Use configured wait time between steps
                    if wait_time > 0:
                        logger.debug(
                            f"Waiting {wait_time}s between steps")
                        await asyncio.sleep(wait_time)

                    # Add the computer_call_output to conversation items
                    current_url = page.url if not page.is_closed() else "about:blank"
                    cc_output = {
                        "type": "computer_call_output",
                        "call_id": call_id,
                        "acknowledged_safety_checks": ack_checks,
                        "output": {
                            "type": "input_image",
                            "image_url": f"data:image/png;base64,{screenshot_b64}",
                            "current_url": current_url
                        }
                    }
                    conversation_items.append(cc_output)

                    logger.info(
                        f"Added computer_call_output for {action['type']}")
                    # Then yield the result with explicit type
                    tool_result_msg = ToolMessage(
                        content=[{
                            "type": "image",
                            "source": {
                                "media_type": "image/png",
                                "data": screenshot_b64
                            },
                            "current_url": current_url,
                            "tool_name": action["type"],
                            "tool_args": action
                        }],
                        tool_call_id=call_id,
                        type="tool",  # Required by ToolMessage
                        # Add name to make it clear this is a result
                        name=action["type"],
                        args=action,  # Add args to make it clear this is a result
                        # Explicitly mark as result
                        metadata={"message_type": "tool_result"}
                    )
                    logger.info(
                        f"[TOOL_RESULT] Yielding result for {action['type']} (id: {call_id})")
                    yield tool_result_msg

                elif item_type == "reasoning":
                    # Reasoning item - you can ignore or store it
                    logger.debug("Skipping reasoning item")
                    pass

                elif item_type == "function_call":
                    # The model is calling one of our functions: goto, back, forward, change_url
                    call_id = item["call_id"]
                    fn_name = item["name"]
                    try:
                        fn_args = json.loads(item["arguments"])
                    except:
                        fn_args = {}

                    # Let the front-end know about this function call
                    tool_call_msg = _create_tool_message(
                        content={"name": fn_name, "args": fn_args},
                        tool_call_id=call_id,
                        is_call=True
                    )
                    yield tool_call_msg

                    # Actually perform the function
                    logger.info(f"Handling function call: {fn_name} with call_id: {call_id}")

                    try:
                        screenshot_b64 = None
                        if fn_name == "goto" or fn_name == "change_url":
                            url = fn_args.get("url", "about:blank")
                            await page.goto(url)
                            screenshot_b64 = base64.b64encode(
                                await page.screenshot(full_page=False)
                            ).decode("utf-8")

                        elif fn_name == "back":
                            await page.go_back()
                            screenshot_b64 = base64.b64encode(
                                await page.screenshot(full_page=False)
                            ).decode("utf-8")

                        elif fn_name == "forward":
                            await page.go_forward()
                            screenshot_b64 = base64.b64encode(
                                await page.screenshot(full_page=False)
                            ).decode("utf-8")

                        else:
                            raise ValueError(f"Unknown function name: {fn_name}")

                        # Build success output
                        current_url = page.url if not page.is_closed() else "about:blank"
                        function_output = {
                            "type": "computer_call_output",
                            "call_id": call_id,
                            "output": {
                                "type": "input_image",
                                "image_url": f"data:image/png;base64,{screenshot_b64}",
                                "current_url": current_url,
                                "tool_name": fn_name,
                                "tool_args": fn_args
                            }
                        }
                        conversation_items.append(function_output)

                        # Then yield the final "tool result" as a message
                        tool_result_msg = _create_tool_message(
                            content=[{
                                "type": "image",
                                "source": {"media_type": "image/png", "data": screenshot_b64},
                                "current_url": current_url,
                                "tool_name": fn_name,
                                "tool_args": fn_args
                            }],
                            tool_call_id=call_id,
                            is_call=False
                        )
                        yield tool_result_msg

                    except Exception as nav_err:
                        logger.error(f"Error in function '{fn_name}': {nav_err}")
                        error_output = {
                            "type": "computer_call_output",
                            "call_id": call_id,
                            "output": {
                                "type": "error",
                                "error": str(nav_err),
                                "tool_name": fn_name,
                                "tool_args": fn_args,
                            }
                        }
                        conversation_items.append(error_output)

                        tool_result_msg = _create_tool_message(
                            content=[{
                                "type": "error",
                                "error": str(nav_err),
                                "tool_name": fn_name,
                                "tool_args": fn_args
                            }],
                            tool_call_id=call_id,
                            is_call=False
                        )
                        yield tool_result_msg

                elif item_type == "assistant":
                    # A final assistant message
                    received_assistant = True
                    logger.info("Received final assistant message")
                    content_array = item["content"]
                    if content_array:
                        final_text = "".join(
                            part["text"] for part in content_array if part["type"] == "output_text")
                        if final_text.strip():
                            logger.info(
                                f"Yielding final assistant msg: {final_text[:100]}...")
                            yield AIMessage(content=final_text)
                else:
                    # Unknown item type - log it but continue
                    logger.warning(f"Unknown item type: {item_type}")
                    logger.debug(f"Item content: {json.dumps(item, indent=2)}")

            # Check if we got an assistant message
            if received_assistant:
                logger.info("Received assistant message, ending conversation")
                break  # End the main loop

            logger.debug("No assistant message in this batch, continuing loop")

        logger.info("Exited main loop, finishing agent execution")
        yield "[OPENAI-CUA] Agent ended."
