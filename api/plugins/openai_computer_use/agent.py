import asyncio
import base64
import json
import os
import requests
import logging
import datetime

from typing import AsyncIterator, Any, Dict, List, Mapping, Optional
from steel import Steel
from playwright.async_api import async_playwright, Page
from fastapi import HTTPException

from api.models import ModelConfig
from api.utils.types import AgentSettings
from langchain_core.messages import BaseMessage
from api.utils.prompt import chat_dict_to_base_messages
from dotenv import load_dotenv
from .prompts import SYSTEM_PROMPT
from langchain_core.messages import ToolMessage
from langchain.schema import AIMessage
load_dotenv(".env.local")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("openai_computer_use")

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"

# Hardcoded settings instead of using agent_settings
MAX_STEPS = 30
WAIT_TIME_BETWEEN_STEPS = 1
NUM_IMAGES_TO_KEEP = 10

def _make_cua_content_for_role(role: str, text: str) -> List[Dict[str, str]]:
    """
    Convert user/system vs assistant text into the correct format:
      user/system -> input_text
      assistant -> output_text
    """
    if role in ("user", "system"):
        return [{"type": "input_text", "text": text}]
    elif role == "assistant":
        return [{"type": "output_text", "text": text}]
    else:
        # fallback if you have other roles
        return [{"type": "input_text", "text": text}]

def _create_tools() -> List[Dict[str, Any]]:
    """
    Return a list of 'tools' recognized by the CUA model, including the
    'computer-preview' tool for environment AND a 'goto' function 
    for easy URL navigation.
    """
    return [
        # The required computer-preview tool:
        {
            "type": "computer-preview",
            "display_width": 1280,
            "display_height": 800,
            "environment": "browser"
        },
        # Our custom 'goto' function tool:
        {
            "type": "function",
            "name": "goto",
            "description": "Navigate to a specific URL",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The fully-qualified URL to navigate to"
                    }
                },
                "required": ["url"],
                "additionalProperties": False
            }
        },
    ]

async def _execute_computer_action(page: Page, action: Dict[str, Any]) -> str:
    """
    Given a single computer action dict, do that action via Playwright,
    then return the base64 encoded screenshot.
    """
    action_type = action.get("type")
    logger.info(f"Executing computer action: {action_type}")

    # If the page or browser closed unexpectedly, short-circuit
    if page.is_closed():
        logger.warning("Page is already closed, skipping action")
        return ""

    try:
        if action_type == "click":
            x = action.get("x", 0)
            y = action.get("y", 0)
            button = action.get("button", "left")
            logger.debug(f"Clicking at ({x}, {y}), button={button}")
            await page.mouse.move(x, y)
            await page.mouse.click(x, y, button=button)

        elif action_type == "scroll":
            x, y = action.get("x", 0), action.get("y", 0)
            sx, sy = action.get("scroll_x", 0), action.get("scroll_y", 0)
            logger.debug(f"Scrolling at ({x}, {y}) by ({sx}, {sy})")
            await page.mouse.move(x, y)
            await page.evaluate(f"window.scrollBy({sx}, {sy})")

        elif action_type == "type":
            text = action.get("text", "")
            logger.debug(f"Typing text: {text[:50]} ...")
            await page.keyboard.type(text)

        elif action_type == "keypress":
            keys = action.get("keys", [])
            logger.debug(f"Pressing keys: {keys}")
            for k in keys:
                await page.keyboard.press(k)

        elif action_type == "wait":
            ms = action.get("ms", 1000)
            logger.debug(f"Waiting {ms} ms")
            await asyncio.sleep(ms / 1000)

        elif action_type == "move":
            x, y = action.get("x", 0), action.get("y", 0)
            logger.debug(f"Moving to ({x}, {y})")
            await page.mouse.move(x, y)

        elif action_type == "drag":
            path = action.get("path", [])
            logger.debug(f"Dragging path with {len(path)} points")
            if path:
                first = path[0]
                await page.mouse.move(first[0], first[1])
                await page.mouse.down()
                for pt in path[1:]:
                    await page.mouse.move(pt[0], pt[1])
                await page.mouse.up()

        elif action_type == "screenshot":
            logger.debug("CUA requested screenshot action. Just capturing screenshot.")

        else:
            logger.warning(f"Unknown action type: {action_type}")

        logger.info("Taking screenshot after action")
        screenshot_bytes = await page.screenshot(full_page=False)
        
        # Convert to base64 for API
        screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
        
        return screenshot_b64

    except Exception as e:
        logger.error(f"Error executing computer action '{action_type}': {e}")
        raise

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
    Demonstration of how to integrate OpenAI's computer-use-preview model
    in your existing app:
      1) Connect to a Steel session.
      2) Start a local loop with the 'responses' endpoint.
      3) On each 'computer_call', do the requested action & screenshot.
      4) Return the screenshot as 'computer_call_output'.
    """
    logger.info(f"Starting OpenAI Computer Use agent with session_id: {session_id}")
    logger.info(f"Using model: {model_config.model_name}")

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
        raise HTTPException(status_code=400, detail=f"Failed to retrieve session: {e}")
    
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

        # Set viewport
        await page.set_viewport_size({"width": 1280, "height": 800})
        logger.info("Set viewport size to 1280x800")

        # Navigate to Hacker News
        logger.info("Navigating to Hacker News...")
        await page.goto("https://news.ycombinator.com")
        yield "[OPENAI-CUA] Loaded Hacker News as a starting page."

        # Convert user history to base messages
        logger.info("Converting user history to base messages...")
        base_msgs: List[BaseMessage] = chat_dict_to_base_messages(history)
        logger.info(f"Converted {len(base_msgs)} messages from history")

        # Initialize conversation items array
        conversation_items: List[Dict[str, Any]] = []

        # Add system prompt as 'system' (-> input_text)
        logger.info("Adding system prompt to conversation")
        if agent_settings.system_prompt:
            system_text = (
                agent_settings.system_prompt
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
                logger.debug(f"Processing tool response with call_id: {m.tool_call_id}")
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
        logger.info(f"Processed {len(conversation_items)} total conversation items")

        # Main loop
        steps = 0
        while True:
            if cancel_event and cancel_event.is_set():
                logger.info("Cancel event detected, exiting agent loop")
                yield "[OPENAI-CUA] Cancel event detected, stopping..."
                break
            if steps > MAX_STEPS:
                logger.info(f"Reached maximum steps ({MAX_STEPS}), exiting agent loop")
                yield f"[OPENAI-CUA] Reached max steps ({MAX_STEPS}), stopping..."
                break

            steps += 1
            logger.info(f"Starting step {steps}/{MAX_STEPS}")

            # 3) Call OpenAI /v1/responses endpoint
            logger.info("Preparing OpenAI API request...")
            openai_api_key = os.getenv("OPENAI_API_KEY") or model_config.api_key
            if not openai_api_key:
                logger.error("No OpenAI API key configured")
                raise HTTPException(400, "No OPENAI_API_KEY configured")

            # Validate model name
            model_name = model_config.model_name or "computer-use-preview-2025-02-04"
            valid_models = ["computer-use-preview", "computer-use-preview-2025-02-04"]
            if model_name not in valid_models:
                logger.error(f"Invalid model name: {model_name}. Must be one of: {valid_models}")
                raise HTTPException(400, f"Invalid model name: {model_name}")

            # The 'tools' array includes both "computer-preview" and "goto" 
            # so the model can call them
            tools = _create_tools()

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
                logger.debug(f"Request body: {json.dumps(request_body, indent=2)}")

                resp = requests.post(OPENAI_RESPONSES_URL, json=request_body, headers=headers, timeout=120)
                if not resp.ok:
                    error_detail = ""
                    try:
                        error_json = resp.json()
                        error_detail = json.dumps(error_json, indent=2)
                    except:
                        error_detail = resp.text

                    logger.error(f"OpenAI API error response ({resp.status_code}):")
                    logger.error(f"Response headers: {dict(resp.headers)}")
                    logger.error(f"Response body: {error_detail}")

                resp.raise_for_status()
                logger.info("Successfully received response from OpenAI")

            except requests.exceptions.RequestException as e:
                logger.error(f"Error calling OpenAI CUA endpoint: {str(e)}")
                if hasattr(e, 'response') and e.response is not None:
                    try:
                        error_json = e.response.json()
                        logger.error(f"Error details: {json.dumps(error_json, indent=2)}")
                    except:
                        logger.error(f"Error text: {e.response.text}")
                yield f"Error calling OpenAI CUA endpoint: {str(e)}"
                break

            data = resp.json()
            if "output" not in data:
                logger.error(f"No 'output' in response: {data}")
                yield f"No 'output' in /v1/responses result: {data}"
                break

            # 4) Process output items
            new_items = data["output"]
            logger.info(f"Received {len(new_items)} new items from OpenAI")
            conversation_items.extend(new_items)

            for item in new_items:
                item_type = item.get("type")
                logger.debug(f"Processing item of type: {item_type}")

                if item_type == "message":
                    # It's a chunk of user or assistant text
                    text_segments = item["content"]
                    # The model uses "input_text" or "output_text"
                    # We'll combine them all just to display
                    full_text = "".join(seg["text"] for seg in text_segments if seg["type"] in ["input_text","output_text"])
                    if full_text.strip():
                        logger.info(f"Yielding message text: {full_text[:100]}...")
                        yield full_text

                elif item_type == "computer_call":
                    # The model wants us to do something (e.g. click, type, etc.)
                    call_id = item["call_id"]
                    action = item["action"]
                    ack_checks = item.get("pending_safety_checks", [])

                    # First yield the tool call with explicit type
                    # tool_call_msg = _create_tool_message(
                    #     content={
                    #         "name": action["type"],
                    #         "args": action,
                    #     },
                    #     tool_call_id=call_id,
                    #     is_call=True
                    # )
                    tool_call_msg = {
                        "name": action["type"],
                        "args": action,
                        "id": call_id
                    }

                    logger.info(f"RAW TOOL CALL OBJECT: {tool_call_msg}")
                    logger.info(f"[TOOL_CALL] Yielding computer action call: {action['type']} (id: {call_id})")
                    
                    yield AIMessage(content="", tool_calls=[tool_call_msg])

                    # Log complete action details
                    action_details = json.dumps(action, indent=2)
                    logger.info(f"Executing computer action (call_id: {call_id}):\n{action_details}")
                    if ack_checks:
                        logger.info(f"Safety checks to acknowledge: {json.dumps(ack_checks, indent=2)}")

                    # Actually do the action and get screenshot
                    screenshot_b64 = await _execute_computer_action(page, action)
                    logger.info(f"Executed computer action successfully")

                    if WAIT_TIME_BETWEEN_STEPS > 0:
                        logger.debug(f"Waiting {WAIT_TIME_BETWEEN_STEPS}s between steps")
                        await asyncio.sleep(WAIT_TIME_BETWEEN_STEPS)

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

                    logger.info(f"Added computer_call_output for {action['type']}")
                    # Then yield the result with explicit type
                    tool_result_msg = ToolMessage(
                        content=[{
                            "type": "image",
                            "image_url": f"data:image/png;base64,{screenshot_b64}",
                            "current_url": current_url,
                            "tool_name": action["type"],
                            "tool_args": action
                        }],
                        tool_call_id=call_id,
                        type="tool",  # Required by ToolMessage
                        name=action["type"],  # Add name to make it clear this is a result
                        args=action,  # Add args to make it clear this is a result
                        metadata={"message_type": "tool_result"}  # Explicitly mark as result
                    )
                    logger.info(f"[TOOL_RESULT] Yielding result for {action['type']} (id: {call_id})")
                    yield tool_result_msg

                elif item_type == "reasoning":
                    # Reasoning item - you can ignore or store it
                    logger.debug("Skipping reasoning item")
                    pass

                elif item_type == "function_call":
                    # The model is calling our 'goto' function or something else
                    call_id = item["call_id"]
                    fn_name = item["name"]
                    try:
                        fn_args = json.loads(item["arguments"])
                    except:
                        fn_args = {}

                    # First yield the tool call with explicit type
                    tool_call_msg = _create_tool_message(
                        content={
                            "name": fn_name,
                            "args": fn_args,
                        },
                        tool_call_id=call_id,
                        is_call=True
                    )
                    logger.info(f"[TOOL_CALL] Yielding function call: {fn_name} (id: {call_id})")
                    yield tool_call_msg

                    logger.info(f"[FUNCTION_CALL] Handling function call: {fn_name} with call_id: {call_id}")

                    # If the user is calling 'goto(url)', do it
                    if fn_name == "goto":
                        url = fn_args.get("url", "about:blank")
                        try:
                            await page.goto(url)
                            logger.info(f"[GOTO] Successfully navigated to {url}")
                            # Take a screenshot after navigation
                            screenshot_bytes = await page.screenshot(full_page=False)
                            screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")

                            # Format output consistently with computer_call_output
                            current_url = page.url if not page.is_closed() else "about:blank"
                            function_output = {
                                "type": "computer_call_output",
                                "call_id": call_id,
                                "output": {
                                    "type": "input_image",
                                    "image_url": f"data:image/png;base64,{screenshot_b64}",
                                    "current_url": current_url,
                                    "tool_name": "goto",
                                    "tool_args": fn_args
                                }
                            }
                            conversation_items.append(function_output)
                            
                            # Then yield the result with explicit type
                            tool_result_msg = _create_tool_message(
                                content=[{
                                    "type": "image",
                                    "image_url": f"data:image/png;base64,{screenshot_b64}",
                                    "current_url": current_url,
                                    "tool_name": "goto",
                                    "tool_args": fn_args
                                }],
                                tool_call_id=call_id,
                                is_call=False
                            )
                            logger.info(f"[TOOL_RESULT] Yielding successful goto result (id: {call_id})")
                            yield tool_result_msg

                        except Exception as nav_err:
                            logger.error(f"[ERROR] Failed to navigate to {url}: {nav_err}")
                            error_output = {
                                "type": "computer_call_output",
                                "call_id": call_id,
                                "output": {
                                    "type": "error",
                                    "error": str(nav_err),
                                    "tool_name": "goto",
                                    "tool_args": fn_args
                                }
                            }
                            conversation_items.append(error_output)
                            
                            # Yield error result with explicit type
                            tool_result_msg = _create_tool_message(
                                content=[{
                                    "type": "error",
                                    "error": str(nav_err),
                                    "tool_name": "goto",
                                    "tool_args": fn_args
                                }],
                                tool_call_id=call_id,
                                is_call=False
                            )
                            logger.info(f"[TOOL_RESULT] Yielding error result for goto (id: {call_id})")
                            yield tool_result_msg

                    else:
                        logger.warning(f"[ERROR] Unknown function name: {fn_name}")
                        error_output = {
                            "type": "computer_call_output",
                            "call_id": call_id,
                            "output": {
                                "type": "error",
                                "error": f"Function '{fn_name}' not recognized",
                                "tool_name": fn_name
                            }
                        }
                        conversation_items.append(error_output)
                        
                        # Yield error result with explicit type
                        tool_result_msg = _create_tool_message(
                            content=[{
                                "type": "error",
                                "error": f"Function '{fn_name}' not recognized",
                                "tool_name": fn_name
                            }],
                            tool_call_id=call_id,
                            is_call=False
                        )
                        logger.info(f"[TOOL_RESULT] Yielding error result for unknown function (id: {call_id})")
                        yield tool_result_msg

                elif item_type == "assistant":
                    # A final assistant message
                    logger.info("Received final assistant message")
                    content_array = item["content"]
                    if content_array:
                        final_text = "".join(part["text"] for part in content_array if part["type"]=="output_text")
                        if final_text.strip():
                            logger.info(f"Yielding final assistant msg: {final_text[:100]}...")
                            yield f"\nAssistant:\n{final_text}\n"
                    logger.info("Ending conversation")
                    yield "[OPENAI-CUA] Conversation complete."
                    return

            logger.debug("No final message, continuing to next iteration")

        logger.info("Exited main loop, finishing agent execution")
        yield "[OPENAI-CUA] Agent ended (max steps reached or canceled)."
