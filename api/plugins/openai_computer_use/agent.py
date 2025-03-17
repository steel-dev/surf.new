"""
OpenAI Computer Use Agent - Main Module

This module contains the main agent function that orchestrates the interaction 
between the OpenAI computer-use-preview model and the Steel browser automation.
"""

import asyncio
import json
import logging
import os
import signal
from typing import AsyncIterator, Any, Dict, List, Mapping, Optional, Set

from fastapi import HTTPException
from playwright.async_api import async_playwright
from langchain_core.messages import BaseMessage
from api.models import ModelConfig
from api.utils.types import AgentSettings
from api.utils.prompt import chat_dict_to_base_messages

# Import from our own modules
from .config import (
    STEEL_API_KEY, STEEL_API_URL, STEEL_CONNECT_URL, OPENAI_RESPONSES_URL,
    VALID_OPENAI_CUA_MODELS, DEFAULT_MAX_STEPS, DEFAULT_WAIT_TIME_BETWEEN_STEPS,
    DEFAULT_NUM_IMAGES_TO_KEEP
)
from .prompts import SYSTEM_PROMPT
from .tools import _create_tools
from .cursor_overlay import inject_cursor_overlay
from .steel_computer import SteelComputer
from .conversation_manager import ConversationManager
from .message_handler import MessageHandler

logger = logging.getLogger("openai_computer_use")

async def openai_computer_use_agent(
    model_config: ModelConfig,
    agent_settings: AgentSettings,
    history: List[Mapping[str, Any]],
    session_id: str,
    cancel_event: Optional[asyncio.Event] = None,
) -> AsyncIterator[Any]:
    """
    OpenAI's computer-use-preview model integration, refactored for clarity.

    Steps:
      1. Validate model, create session & connect to browser
      2. Initialize ConversationManager + MessageHandler
      3. Main loop that:
         - Prepares conversation => calls /v1/responses => processes items
         - Yields messages or tool calls => executes tool calls => yields results
         - Repeats until we get a final "assistant" item or exceed max steps
    """
    # Keep track of background tasks we create
    pending_tasks: Set[asyncio.Task] = set()
    
    # Helper to track and clean up tasks
    def track_task(task: asyncio.Task) -> None:
        pending_tasks.add(task)
        task.add_done_callback(lambda t: pending_tasks.discard(t))

    logger.info(f"Starting openai_computer_use_agent with session_id: {session_id}")
    openai_api_key = model_config.api_key or os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise HTTPException(status_code=400, detail="No OPENAI_API_KEY configured")

    # Validate model name
    model_name = model_config.model_name or "computer-use-preview-2025-02-04"
    if model_name not in VALID_OPENAI_CUA_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model name: {model_name}. Must be one of: {VALID_OPENAI_CUA_MODELS}",
        )

    # Extract settings with defaults
    max_steps = getattr(agent_settings, "max_steps", DEFAULT_MAX_STEPS)
    wait_time = getattr(agent_settings, "wait_time_between_steps", DEFAULT_WAIT_TIME_BETWEEN_STEPS)
    num_images = getattr(agent_settings, "num_images_to_keep", DEFAULT_NUM_IMAGES_TO_KEEP)

    # Create a Steel session
    from steel import Steel
    client = Steel(steel_api_key=STEEL_API_KEY, base_url=STEEL_API_URL)
    try:
        session = client.sessions.retrieve(session_id)
        logger.info(f"Successfully connected to Steel session: {session.id}")
        logger.info(f"Session viewer URL: {session.session_viewer_url}")
        yield "[OPENAI-CUA] Session loaded. Connecting to remote browser..."
    except Exception as exc:
        logger.error(f"Failed to retrieve Steel session: {exc}")
        raise HTTPException(400, f"Failed to retrieve Steel session: {exc}")

    # Set up a handler for SIGINT (keyboard interrupt) to allow cleanup
    original_sigint_handler = None
    if hasattr(signal, "SIGINT"):
        original_sigint_handler = signal.getsignal(signal.SIGINT)
        def sigint_handler(sig, frame):
            logger.info("SIGINT received, preparing for shutdown")
            if cancel_event:
                cancel_event.set()
            # Don't call the default handler yet - let cleanup run first
        signal.signal(signal.SIGINT, sigint_handler)

    # Connect to browser
    steel_computer = None
    playwright_instance = None
    try:
        # Create a shared cancel event if one wasn't provided
        local_cancel_event = False
        if cancel_event is None:
            cancel_event = asyncio.Event()
            local_cancel_event = True
            
        # Launch playwright
        playwright_instance = await async_playwright().start()
        try:
            browser = await playwright_instance.chromium.connect_over_cdp(
                f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session.id}"
            )
            yield "[OPENAI-CUA] Playwright connected!"
        except Exception as e:
            logger.error(f"Failed to connect Playwright over CDP: {e}")
            yield f"Error: could not connect to browser session (CDP) - {e}"
            return

        # Initialize SteelComputer - this handles all browser management
        steel_computer = await SteelComputer.create(browser)
        
        # Initialize MessageHandler and ConversationManager
        msg_handler = MessageHandler(steel_computer)
        conversation = ConversationManager(num_images_to_keep=num_images)

        # Load history + system prompt
        system_prompt = agent_settings.system_prompt or SYSTEM_PROMPT
        base_msgs = chat_dict_to_base_messages(history)
        conversation.initialize_from_history(base_msgs, system_prompt=system_prompt)

        # Get viewport size for computer-preview tool
        viewport_size = await steel_computer.get_viewport_size()

        # Setup model request parameters
        headers = {
            "Authorization": f"Bearer {openai_api_key}",
            "Content-Type": "application/json",
            # OpenAI "Beta" header for /v1/responses
            "OpenAI-Beta": "responses=v1",
            "Openai-Beta": "responses=v1",
        }

        step_count = 0
        request_task = None

        # Main loop
        try:
            while True:
                if cancel_event and cancel_event.is_set():
                    logger.info("Cancel event detected, exiting agent loop")
                    yield "[OPENAI-CUA] Cancel event detected, stopping..."
                    break
                    
                if step_count >= max_steps:
                    logger.info(f"Reached maximum steps ({max_steps}), exiting agent loop")
                    yield f"[OPENAI-CUA] Reached max steps ({max_steps}), stopping..."
                    break

                step_count += 1
                logger.info(f"Starting step {step_count}/{max_steps}")

                # Prepare the conversation for /v1/responses
                items_for_model = conversation.prepare_for_model()
                tools_for_model = _create_tools()
                
                # Update the display dimensions in the computer-preview tool
                for tool in tools_for_model:
                    if tool.get("type") == "computer-preview":
                        tool["display_width"] = viewport_size["width"]
                        tool["display_height"] = viewport_size["height"]
                        break

                request_body = {
                    "model": model_name,
                    "input": items_for_model,
                    "tools": tools_for_model,
                    "truncation": "auto",
                    "reasoning": {"generate_summary": "concise"},
                }

                # Make the request
                try:
                    logger.info("Sending request to OpenAI /v1/responses endpoint...")
                    
                    # Create a task for the request with a timeout
                    async def make_request():
                        import aiohttp
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

                                    logger.error(f"OpenAI API error response ({resp.status}):")
                                    logger.error(f"Response headers: {dict(resp.headers)}")
                                    logger.error(f"Response body: {error_detail}")
                                    resp.raise_for_status()

                                return await resp.json()

                    # Create and track the request task
                    request_task = asyncio.create_task(make_request())
                    track_task(request_task)

                    # Wait for either the request to complete or cancellation
                    # Create a task that waits for cancellation
                    if cancel_event:
                        cancellation_task = asyncio.create_task(cancel_event.wait())
                        track_task(cancellation_task)
                        
                        # Wait for either request to complete or cancellation
                        done, pending = await asyncio.wait(
                            [request_task, cancellation_task],
                            return_when=asyncio.FIRST_COMPLETED
                        )
                        
                        # If cancellation happened first
                        if cancellation_task in done:
                            # Cancel the request_task
                            if not request_task.done():
                                request_task.cancel()
                                logger.info("Request cancelled due to cancel event")
                            yield "[OPENAI-CUA] Request cancelled..."
                            break
                        
                        # Otherwise, cancel the cancellation_task (no longer needed)
                        if not cancellation_task.done():
                            cancellation_task.cancel()
                    else:
                        # Just wait for the request if no cancellation event
                        await request_task

                    # Check if cancelled while we were waiting
                    if cancel_event and cancel_event.is_set():
                        logger.info("Cancel event detected after request")
                        if not request_task.done():
                            request_task.cancel()
                        yield "[OPENAI-CUA] Request cancelled..."
                        break

                    # Get the result (will raise if cancelled)
                    data = request_task.result()

                except asyncio.CancelledError:
                    logger.info("Request was cancelled")
                    yield "[OPENAI-CUA] Request cancelled..."
                    break
                except Exception as ex:
                    logger.error(f"Error making request to OpenAI: {ex}")
                    yield f"[OPENAI-CUA] Error from OpenAI: {str(ex)}"
                    break

                if "output" not in data:
                    logger.error(f"No 'output' in response: {data}")
                    yield f"No 'output' in /v1/responses result: {data}"
                    break

                new_items = data["output"]
                logger.info(f"Received {len(new_items)} new items from OpenAI")

                got_final_assistant = False
                for item in new_items:
                    # Check for cancellation inside loop
                    if cancel_event and cancel_event.is_set():
                        logger.info("Cancel event detected while processing items")
                        break
                        
                    # Add this item to conversation first
                    conversation.add_item(item)

                    # Process the item
                    immediate_msg, action_needed = await msg_handler.process_item(item)

                    # 1. If there's an immediate message (e.g. partial AI chunk), yield it
                    if immediate_msg:
                        yield immediate_msg
                        # Check if it's a "reasoning" item, yield a stop marker for visual break
                        if item.get("type") == "reasoning":
                            yield {"stop": True}
                        # If it's an assistant item, mark as final
                        if item.get("type") == "assistant":
                            got_final_assistant = True

                    # 2. If an action is required (tool call), do it
                    if action_needed:
                        # Wait the configured time between steps if needed
                        if wait_time > 0:
                            logger.debug(f"Waiting {wait_time}s between steps")
                            await asyncio.sleep(wait_time)

                        # Execute the action and get results
                        result_item, result_tool_msg = await msg_handler.execute_action(action_needed)
                        
                        # Add the result to conversation
                        conversation.add_item(result_item)
                        
                        # Yield the tool result message
                        yield result_tool_msg

                # Check again for cancellation
                if cancel_event and cancel_event.is_set():
                    break
                    
                # If we got a final assistant message, end the conversation
                if got_final_assistant:
                    logger.info("Received final assistant message, ending conversation")
                    break
        finally:
            # Clean up any pending tasks we created
            logger.info(f"Cleaning up {len(pending_tasks)} pending tasks")
            for task in pending_tasks:
                if not task.done():
                    task.cancel()
                
            # Wait briefly for tasks to clean up
            if pending_tasks:
                try:
                    await asyncio.wait(pending_tasks, timeout=0.5)
                except asyncio.CancelledError:
                    pass

            # Clean up browser resources
            if steel_computer:
                logger.info("Cleaning up SteelComputer resources")
                await steel_computer.cleanup()

        # End of main loop
        logger.info("Exited main loop, finishing agent execution")
        yield "[OPENAI-CUA] Agent ended."
    except Exception as e:
        logger.error(f"Unexpected error in agent: {e}", exc_info=True)
        # Attempt cleanup even on error
        if steel_computer:
            try:
                await steel_computer.cleanup()
            except Exception as cleanup_err:
                logger.error(f"Error during emergency cleanup: {cleanup_err}")
        yield f"[OPENAI-CUA] Error: {str(e)}"
    finally:
        # Close the playwright instance
        if playwright_instance:
            try:
                await playwright_instance.stop()
                logger.info("Closed Playwright instance")
            except Exception as e:
                logger.error(f"Error closing Playwright instance: {e}")
        
        # Restore original SIGINT handler
        if original_sigint_handler and hasattr(signal, "SIGINT"):
            signal.signal(signal.SIGINT, original_sigint_handler)
            
        # Clean up our local cancel event if we created one
        if local_cancel_event and cancel_event and not cancel_event.is_set():
            cancel_event.set()
