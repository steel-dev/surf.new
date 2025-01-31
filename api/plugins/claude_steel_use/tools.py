import asyncio
import base64
from enum import Enum
from typing import Mapping, Optional, Tuple, Type
import io
from pydantic import BaseModel, Field
from playwright.async_api import Page, async_playwright
from PIL import Image, ImageDraw
from langchain_core.tools import BaseTool

################################################################################
# Pydantic Models
################################################################################

# @todo: Implement a wait tool that waits for a given number of seconds


class ActionEnum(str, Enum):
    key = "key"
    type = "type"
    mouse_move = "mouse_move"
    left_click = "left_click"
    left_click_drag = "left_click_drag"
    right_click = "right_click"
    middle_click = "middle_click"
    double_click = "double_click"
    screenshot = "screenshot"
    cursor_position = "cursor_position"


class GoToUrlParams(BaseModel):
    url: str
    wait_time: Optional[int] = Field(
        None, description="Time in ms to wait before screenshot"
    )


class GoToUrlResult(BaseModel):
    type: str = "image"
    source: dict = Field(default_factory=dict)


class GetCurrentUrlParams(BaseModel):
    # This can be empty if no arguments are required; just here for consistency.
    pass


class GetCurrentUrlResult(BaseModel):
    content: str


class SaveToMemoryParams(BaseModel):
    information: str


class SaveToMemoryResult(BaseModel):
    content: str


class ClaudComputerToolParams(BaseModel):
    action: ActionEnum
    text: Optional[str] = None
    coordinate: Optional[Tuple[int, int]] = None
    wait_time: Optional[int] = Field(
        None, description="Time in ms to wait before screenshot"
    )


class ClaudComputerToolResult(BaseModel):
    type: str = "image"
    source: dict = Field(default_factory=dict)


class WaitParams(BaseModel):
    seconds: int


################################################################################
# Constants and Helper Functions
################################################################################

ERROR_IMAGE = "iVBORw0KGgoAAAANSUhEUgAAAAUA..."  # Example placeholder
DEFAULT_SCREENSHOT_WAIT_MS = 1
DUMMY_SCREENSHOT = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="


async def _sleep(s: int):
    """Async sleep helper to match the TS sleep(s) usage."""
    print(f"😴 Sleeping for {s}s")
    await asyncio.sleep(s)


def _translate_key(key: str) -> str:
    """
    Map xdotool-like 'key' strings to Playwright-compatible keys.
    Reference: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
    """
    key_map = {
        # Common / Basic Keys
        "return": "Enter",
        "enter": "Enter",
        "tab": "Tab",
        "backspace": "Backspace",
        "up": "ArrowUp",
        "down": "ArrowDown",
        "left": "ArrowLeft",
        "right": "ArrowRight",
        "space": "Space",
        "ctrl": "Control",
        "control": "Control",
        "alt": "Alt",
        "shift": "Shift",
        "meta": "Meta",
        "command": "Meta",
        "windows": "Meta",
        "esc": "Escape",
        "escape": "Escape",
        # Numpad Keys
        "kp_0": "Numpad0",
        "kp_1": "Numpad1",
        "kp_2": "Numpad2",
        "kp_3": "Numpad3",
        "kp_4": "Numpad4",
        "kp_5": "Numpad5",
        "kp_6": "Numpad6",
        "kp_7": "Numpad7",
        "kp_8": "Numpad8",
        "kp_9": "Numpad9",
        # Numpad Operations
        "kp_enter": "NumpadEnter",
        "kp_multiply": "NumpadMultiply",
        "kp_add": "NumpadAdd",
        "kp_subtract": "NumpadSubtract",
        "kp_decimal": "NumpadDecimal",
        "kp_divide": "NumpadDivide",
        # Navigation
        "page_down": "PageDown",
        "page_up": "PageUp",
        "home": "Home",
        "end": "End",
        "insert": "Insert",
        "delete": "Delete",
        # Function Keys
        "f1": "F1",
        "f2": "F2",
        "f3": "F3",
        "f4": "F4",
        "f5": "F5",
        "f6": "F6",
        "f7": "F7",
        "f8": "F8",
        "f9": "F9",
        "f10": "F10",
        "f11": "F11",
        "f12": "F12",
        # Left/Right Variants
        "shift_l": "ShiftLeft",
        "shift_r": "ShiftRight",
        "control_l": "ControlLeft",
        "control_r": "ControlRight",
        "alt_l": "AltLeft",
        "alt_r": "AltRight",
        # Media Keys
        "audiovolumemute": "AudioVolumeMute",
        "audiovolumedown": "AudioVolumeDown",
        "audiovolumeup": "AudioVolumeUp",
        # Additional Special Keys
        "print": "PrintScreen",
        "scroll_lock": "ScrollLock",
        "pause": "Pause",
        "menu": "ContextMenu",
    }

    return key_map.get(key.lower(), key)


async def _draw_circle_on_screenshot(screenshot_b64: str, x: int, y: int) -> str:
    """
    Draw a small red circle at (x, y) on the provided base64 screenshot using Pillow.
    Return a new screenshot as base64.
    """
    image_data = base64.b64decode(screenshot_b64)
    with Image.open(io.BytesIO(image_data)) as img:
        draw = ImageDraw.Draw(img)
        radius = 5
        left_up = (x - radius, y - radius)
        right_down = (x + radius, y + radius)
        draw.ellipse([left_up, right_down], fill="red")

        with io.BytesIO() as output:
            img.save(output, format="PNG")
            updated_bytes = output.getvalue()

    return base64.b64encode(updated_bytes).decode("utf-8")


async def _scale_coordinates(
    x: int,
    y: int,
    original_width: int,
    original_height: int,
    target_width: int,
    target_height: int,
) -> Tuple[int, int]:
    """
    Scale the (x, y) coordinates from the original resolution to the target resolution.
    """
    if original_width <= 0 or original_height <= 0:
        # Avoid division error if we don't have valid dims
        return x, y
    scale_x = target_width / original_width
    scale_y = target_height / original_height
    scaled_x = int(x * scale_x)
    scaled_y = int(y * scale_y)
    return scaled_x, scaled_y


################################################################################
# Tool Implementations / Definitions
################################################################################


class GoToUrlTool(BaseTool):
    name: str = "go_to_url"
    description: str = (
        "Navigate to the specified URL, optionally waiting a given number of ms, "
        "and return a base64 screenshot."
    )
    args_schema: Type[BaseModel] = GoToUrlParams
    page: Optional[Page] = None
    wait_time: Optional[int] = None

    def __init__(self, page: Page, wait_time: Optional[int] = None):
        super().__init__()
        self.page = page
        self.wait_time = wait_time

    def _run(self, url: str, wait_time: int = 2000) -> str:
        print("GoToUrlTool._run called (sync) - raising NotImplementedError")
        raise NotImplementedError("This tool is async-only. Please use `_arun()`.")

    async def _arun(self, url: str, wait_time: Optional[int] = None) -> str:
        print("GoToUrlTool._arun called (async)")  # Debug log
        try:
            s = wait_time if wait_time is not None else DEFAULT_SCREENSHOT_WAIT_MS
            await self.page.goto(url, wait_until="domcontentloaded")
        except Exception as exc:
            if "Navigation timeout" in str(exc):
                print(f"Navigation timeout to {url}")
                print(f"Waiting for {s}s")
                await _sleep(s)
                screenshot_buffer = await self.page.screenshot()
                screenshot_b64 = base64.b64encode(screenshot_buffer).decode("utf-8")
                return GoToUrlResult(
                    type="image",
                    source={
                        "type": "base64",
                        "media_type": "image/png",
                        "data": screenshot_b64,
                    },
                ).model_dump()
            else:
                print(f"Error navigating to {url}: {exc}")
                return GoToUrlResult(
                    type="image",
                    source={
                        "type": "base64",
                        "media_type": "image/png",
                        "data": ERROR_IMAGE,
                    },
                ).model_dump()

        s = self.wait_time if self.wait_time is not None else DEFAULT_SCREENSHOT_WAIT_MS
        await _sleep(s)

        screenshot_buffer = await self.page.screenshot()
        screenshot_b64 = base64.b64encode(screenshot_buffer).decode("utf-8")
        return GoToUrlResult(
            type="image",
            source={
                "type": "base64",
                "media_type": "image/png",
                "data": screenshot_b64,
            },
        ).model_dump()


class GetCurrentUrlTool(BaseTool):
    name: str = "get_current_url"
    description: str = (
        "Returns the current URL of the provided page, with no arguments required."
    )
    args_schema: Type[BaseModel] = GetCurrentUrlParams
    page: Optional[Page] = None

    def __init__(self, page: Page):
        super().__init__()
        self.page = page

    def _run(self) -> str:
        print("GetCurrentUrlTool._run called (sync) - raising NotImplementedError")
        raise NotImplementedError("This tool is async-only. Please use `_arun()`.")

    async def _arun(self) -> str:
        print("GetCurrentUrlTool._arun called (async)")  # Debug log
        current_url = self.page.url
        return GetCurrentUrlResult(content=current_url)


# @todo: actually implement this
class SaveToMemoryTool(BaseTool):
    name: str = "save_to_memory"
    description: str = (
        "Accepts a string 'information' and simulates saving it to memory. Returns a success message."
    )
    args_schema: Type[BaseModel] = SaveToMemoryParams

    def __init__(self):
        super().__init__()

    def _run(self, information: str) -> str:
        print("SaveToMemoryTool._run called (sync) - raising NotImplementedError")
        raise NotImplementedError("This tool is async-only. Please use `_arun()`.")

    async def _arun(self, information: str) -> str:
        print(f"Saving {information} to memory (example placeholder).")
        result = SaveToMemoryResult(content="successfully saved to memory")
        return result.json()


class ClaudeComputerTool(BaseTool):
    """
    A tool for performing advanced interactions with a web page using Playwright.

    This tool enables actions like mouse movements, key presses, clicks, and other
    interactions with web elements. After performing the requested action, it captures
    and returns a screenshot of the page. For coordinate-based actions, the screenshot
    may include a red circle highlighting the target coordinate.
    """

    name: str = "claude_computer_tool"
    description: str = (
        "Perform advanced actions on the page (move mouse, press keys, click, etc.). "
        "Returns a base64 screenshot that may have a red circle highlighting a coordinate."
    )
    args_schema: Type[BaseModel] = ClaudComputerToolParams
    page: Optional[Page] = None
    wait_time: Optional[int] = None

    def __init__(self, page: Page, wait_time: Optional[int] = None):
        super().__init__()
        self.page = page
        self.wait_time = wait_time

    def _run(
        self,
        action: ActionEnum,
        text: Optional[str] = None,
        coordinate: Optional[Tuple[int, int]] = None,
        wait_time: Optional[int] = None,
        # Potentially add these if developers can supply viewport sizes
        page_width: Optional[int] = None,
        page_height: Optional[int] = None,
        target_width: Optional[int] = None,
        target_height: Optional[int] = None,
    ) -> str:
        print("ClaudeComputerTool._run called (sync) - raising NotImplementedError")
        raise NotImplementedError("This tool is async-only. Please use `_arun()`.")

    async def _arun(
        self,
        action: ActionEnum,
        text: Optional[str] = None,
        coordinate: Optional[Tuple[int, int]] = None,
        # Potentially add these if developers can supply viewport sizes
        page_width: Optional[int] = None,
        page_height: Optional[int] = None,
        target_width: Optional[int] = None,
        target_height: Optional[int] = None,
    ) -> str:
        # Debug log
        print(f"ClaudeComputerTool._arun called (async) with action='{action}'")
        try:
            s = (
                self.wait_time
                if self.wait_time is not None
                else DEFAULT_SCREENSHOT_WAIT_MS
            )

            if action in [ActionEnum.mouse_move, ActionEnum.left_click_drag]:
                if not coordinate:
                    raise ValueError(f"coordinate is required for action '{action}'")
                x, y = coordinate

                # If we want to scale the coordinates
                # if page_width and page_height and target_width and target_height:
                #     x, y = await _scale_coordinates(x, y, page_width, page_height,
                #                                     target_width, target_height)

                if action == ActionEnum.mouse_move:
                    await self.page.mouse.move(x, y)
                else:
                    await self.page.mouse.move(x, y)
                    await self.page.mouse.down()
                    await self.page.mouse.move(x + 100, y + 100, steps=10)
                    await self.page.mouse.up()
                print(f"Waiting for {s}s")
                await _sleep(s)
                screenshot_buffer = await self.page.screenshot()
                screenshot_b64 = base64.b64encode(screenshot_buffer).decode("utf-8")
                marked_image = await _draw_circle_on_screenshot(screenshot_b64, x, y)
                return ClaudComputerToolResult(
                    type="image",
                    source={
                        "type": "base64",
                        "media_type": "image/png",
                        "data": marked_image,
                    },
                ).model_dump()

            elif action == ActionEnum.key or action == ActionEnum.type:
                if text is None:
                    raise ValueError(f"text is required for action '{action}'")
                # 'key' can involve combos like ctrl+s
                if action == ActionEnum.key:
                    keys = text.split("+")
                    for k in keys[:-1]:
                        await self.page.keyboard.down(_translate_key(k))
                    await self.page.keyboard.press(_translate_key(keys[-1]))
                    for k in reversed(keys[:-1]):
                        await self.page.keyboard.up(_translate_key(k))
                else:
                    await self.page.keyboard.type(text)

                await _sleep(s)
                screenshot_buffer = await self.page.screenshot()
                screenshot_b64 = base64.b64encode(screenshot_buffer).decode("utf-8")
                return ClaudComputerToolResult(
                    type="image",
                    source={
                        "type": "base64",
                        "media_type": "image/png",
                        "data": screenshot_b64,
                    },
                ).model_dump()

            elif action in [
                ActionEnum.left_click,
                ActionEnum.right_click,
                ActionEnum.middle_click,
                ActionEnum.double_click,
                ActionEnum.screenshot,
                ActionEnum.cursor_position,
            ]:
                if action == ActionEnum.screenshot:
                    await _sleep(s)
                    screenshot_buffer = await self.page.screenshot()
                    screenshot_b64 = base64.b64encode(screenshot_buffer).decode("utf-8")
                    return ClaudComputerToolResult(
                        type="image",
                        source={
                            "type": "base64",
                            "media_type": "image/png",
                            "data": screenshot_b64,
                        },
                    ).model_dump()

                elif action == ActionEnum.cursor_position:
                    # There's no direct way to get the cursor from Playwright.
                    # Potential approach:
                    """
                    x = await self.page.evaluate(\"() => window.__cursorPositionX || 0\")
                    y = await self.page.evaluate(\"() => window.__cursorPositionY || 0\")
                    # Return those in a result if your page tracks them.
                    """
                    raise ValueError(
                        "cursor_position action is not supported in Playwright."
                    )

                else:
                    button_map = {
                        ActionEnum.left_click: "left",
                        ActionEnum.right_click: "right",
                        ActionEnum.middle_click: "middle",
                        ActionEnum.double_click: "left",
                    }
                    button = button_map[action]

                    click_count = 2 if action == ActionEnum.double_click else 1
                    await self.page.mouse.down(button=button, click_count=click_count)
                    await self.page.mouse.up(button=button, click_count=click_count)

                    await _sleep(s)
                    screenshot_buffer = await self.page.screenshot()
                    screenshot_b64 = base64.b64encode(screenshot_buffer).decode("utf-8")
                    return ClaudComputerToolResult(
                        type="image",
                        source={
                            "type": "base64",
                            "media_type": "image/png",
                            "data": screenshot_b64,
                        },
                    ).model_dump()
            else:
                raise ValueError(f"Invalid action: '{action}'")

        except Exception as exc:
            print(f"Error executing action '{action}': {exc}")
            return ClaudComputerToolResult(
                type="image",
                source={
                    "type": "base64",
                    "media_type": "image/png",
                    "data": ERROR_IMAGE,
                },
            ).model_dump()


class WaitTool(BaseTool):
    """Tool that waits for a specified number of seconds before continuing."""

    name: str = "wait"
    description: str = (
        "Wait for a specified number of seconds before continuing. "
        "Useful when waiting for page loads or animations to complete."
    )
    args_schema: Type[BaseModel] = WaitParams
    page: Optional[Page] = None

    def __init__(self, page: Page):
        super().__init__()
        self.page = page

    def _run(self, seconds: float) -> str:
        print("WaitTool._run called (sync) - raising NotImplementedError")
        raise NotImplementedError("This tool is async-only. Please use `_arun()`.")

    async def _arun(self, seconds: float) -> str:
        try:
            # Validate seconds is within allowed range
            if not 0 <= seconds <= 30:
                raise ValueError("Wait time must be between 0 and 30 seconds")

            # Convert to milliseconds and wait
            ms = int(seconds * 1000)
            await _sleep(ms)

            # Take screenshot after waiting
            screenshot_buffer = await self.page.screenshot()
            screenshot_b64 = base64.b64encode(screenshot_buffer).decode("utf-8")

            return ClaudComputerToolResult(
                type="image",
                source={
                    "type": "base64",
                    "media_type": "image/png",
                    "data": screenshot_b64,
                },
            ).model_dump()

        except Exception as exc:
            print(f"Error executing wait for {seconds} seconds: {exc}")
            return ClaudComputerToolResult(
                type="image",
                source={
                    "type": "base64",
                    "media_type": "image/png",
                    "data": ERROR_IMAGE,
                },
            ).model_dump()


################################################################################
# If you want a quick reference to all tools in this plugin:
################################################################################

ALL_EXAMPLE_PLUGIN_TOOLS = [
    GoToUrlTool,
    GetCurrentUrlTool,
    SaveToMemoryTool,
    ClaudeComputerTool,
]


def get_available_tools(page: Page):
    """Return a dictionary of the tools provided by this plugin, using a real Page."""
    return {
        "go_to_url": GoToUrlTool(page),
        "get_current_url": GetCurrentUrlTool(page),
        "save_to_memory": SaveToMemoryTool(),
        "claude_computer_tool": ClaudeComputerTool(page),
    }


# def main():
#     """Use async_playwright to create a real Page, then get and print the tools."""
#     import asyncio

#     async def run():
#         async with async_playwright() as p:
#             browser = await p.chromium.launch(headless=True)
#             page = await browser.new_page()
#             tools = get_available_tools(page)

#             for name, tool in tools.items():
#                 print(tool, name)
#                 print(f"Tool name: {name}")
#                 print(f"  Description: {tool.description}")
#                 print(f"  Args schema: {
#                       tool.args_schema.schema_json(indent=2)}")
#                 print(f"  Return Direct: {tool.return_direct}")
#                 print("")
#             await browser.close()

#     asyncio.run(run())


# if __name__ == "__main__":
#     main()
