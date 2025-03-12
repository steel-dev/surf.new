import asyncio
import base64
from typing import Dict, Any, List
from playwright.async_api import Page
import logging
from .key_mapping import translate_key

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("openai_computer_use.tools")


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
                mapped_key = translate_key(k)
                logger.debug(f"Mapped key '{k}' to '{mapped_key}'")
                await page.keyboard.press(mapped_key)

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
            logger.debug(
                "CUA requested screenshot action. Just capturing screenshot.")

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
