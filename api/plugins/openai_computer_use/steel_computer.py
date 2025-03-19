import asyncio
import base64
import json
import logging
from typing import Any, Dict, Tuple, Optional, List, Set

from playwright.async_api import Page, Browser, BrowserContext

from .tools import translate_key
from .cursor_overlay import inject_cursor_overlay

logger = logging.getLogger("openai_computer_use.steel_computer")


class SteelComputer:
    """
    Wraps the browser and page interactions for the OpenAI computer-use agent.
    Responsible for:
      - Managing the browser, context, and pages
      - Handling page navigation and tab management
      - Executing user actions (click, scroll, type, etc.)
      - Capturing screenshots and page state
    """

    def __init__(self, page: Page):
        """Initialize with an active page."""
        self.active_page = page
        self.browser = page.context.browser
        self.context = page.context
        self.logger = logger
        
        # Set up event handlers
        self.context.on("page", self._handle_new_page)
        
        # Initialize tracking for pages that have been set up
        self._setup_pages: Set[Page] = set()
        
        # Track pending tasks
        self._pending_tasks: Set[asyncio.Task] = set()
        
        # Track if we're cleaned up
        self._cleanup_done = False
    
    @classmethod
    async def create(cls, browser: Browser) -> "SteelComputer":
        """Create a new SteelComputer instance with a fresh page."""
        # Get or create a context
        if not browser.contexts:
            context = await browser.new_context()
        else:
            context = browser.contexts[0]
            
        # Get or create a page
        if not context.pages:
            page = await context.new_page()
        else:
            page = context.pages[0]
            
        # Create instance
        computer = cls(page)
        
        # Set up the initial page
        await computer.setup_page(page)
        
        # Navigate to a starting page
        await page.goto("https://www.google.com")
        
        return computer

    async def setup_page(self, page: Page) -> None:
        """Set up a page with necessary scripts and settings."""
        if page in self._setup_pages:
            return
            
        # Get and set viewport size
        viewport_size = await page.evaluate("""() => ({
            width: window.innerWidth, 
            height: window.innerHeight
        })""")
        await page.set_viewport_size(viewport_size)
        self.logger.info(f"Set viewport size to {viewport_size['width']}x{viewport_size['height']}")
        
        # Add cursor overlay to make mouse movements visible
        await inject_cursor_overlay(page)
        self.logger.info("Cursor overlay injected")
        
        # Apply same-tab navigation script
        await self._apply_same_tab_script(page)
        self.logger.info("Same-tab navigation script injected")
        
        # Add page to setup tracking
        self._setup_pages.add(page)

    async def _handle_new_page(self, new_page: Page) -> None:
        """Handler for when a new page is created."""
        self.logger.info(f"New page created: {new_page.url}")
        
        # Set as active page
        self.active_page = new_page
        
        # Wait for the page to load
        await new_page.wait_for_load_state("domcontentloaded")
        new_page.on("close", lambda: self._handle_page_close(new_page))
        
        # Set up the page
        await self.setup_page(new_page)
        
        self.logger.info(f"New page ready: {new_page.url}")

    def _handle_page_close(self, closed_page: Page) -> None:
        """Handler for when a page is closed."""
        self.logger.info(f"Page closed: {closed_page.url}")
        
        # Remove from tracking
        if closed_page in self._setup_pages:
            self._setup_pages.remove(closed_page)
        
        # If the closed page was the active page, set active page to another open page
        if self.active_page == closed_page:
            remaining_pages = self.context.pages
            if remaining_pages:
                self.active_page = remaining_pages[0]
                self.logger.info(f"Active page switched to: {self.active_page.url}")
            else:
                self.logger.warning("No remaining pages open")
                # If no pages are left, create a new one
                task = asyncio.create_task(self._create_new_page())
                self._track_task(task)

    def _track_task(self, task: asyncio.Task) -> None:
        """Track an async task to ensure it's completed before cleanup."""
        self._pending_tasks.add(task)
        task.add_done_callback(lambda t: self._pending_tasks.discard(t))

    async def _create_new_page(self) -> None:
        """Create a new page when all pages are closed."""
        try:
            new_page = await self.context.new_page()
            self.active_page = new_page
            await self.setup_page(new_page)
            await new_page.goto("https://www.google.com")
            self.logger.info("Created new page after all were closed")
        except Exception as e:
            self.logger.error(f"Error creating new page: {e}")

    async def _apply_same_tab_script(self, target_page: Page) -> None:
        """Apply script to make links open in the same tab."""
        await target_page.add_init_script("""
            window.addEventListener('load', () => {
                // Initial cleanup
                document.querySelectorAll('a[target="_blank"]').forEach(a => a.target = '_self');
                
                // Watch for dynamic changes
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.addedNodes) {
                            mutation.addedNodes.forEach((node) => {
                                if (node.nodeType === 1) { // ELEMENT_NODE
                                    // Check the added element itself
                                    if (node.tagName === 'A' && node.target === '_blank') {
                                        node.target = '_self';
                                    }
                                    // Check any anchor children
                                    node.querySelectorAll('a[target="_blank"]').forEach(a => a.target = '_self');
                                }
                            });
                        }
                    });
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            });
        """)

    @property
    def environment(self) -> str:
        """Return the environment type (always 'browser' here)."""
        return "browser"

    async def get_viewport_size(self) -> Dict[str, int]:
        """Return the current viewport dimensions."""
        view_size = await self.active_page.evaluate(
            """() => ({ width: window.innerWidth, height: window.innerHeight })"""
        )
        return view_size

    async def execute_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a single action dictionary from the model, e.g.:
          {
            "type": "click",
            "x": 100,
            "y": 200,
            "button": "left"
          }

        Returns a dict with screenshot + current URL (or error).
        """
        # Make sure we're using the active page
        page = self.active_page
        
        if page.is_closed():
            self.logger.warning("Page is closed; cannot execute action.")
            return {
                "type": "error",
                "error": "Page is closed; cannot execute action",
            }

        action_type = action.get("type")
        self.logger.info(f"Executing action: {action_type}")

        try:
            if action_type == "click":
                x = action.get("x", 0)
                y = action.get("y", 0)
                button = action.get("button", "left")
                await page.mouse.move(x, y)
                await page.mouse.click(x, y, button=button)

            elif action_type == "scroll":
                x, y = action.get("x", 0), action.get("y", 0)
                sx, sy = action.get("scroll_x", 0), action.get("scroll_y", 0)
                await page.mouse.move(x, y)
                # Simple approach: evaluate scrollBy
                await page.evaluate(f"window.scrollBy({sx}, {sy})")

            elif action_type == "type":
                text = action.get("text", "")
                await page.keyboard.type(text)

            elif action_type == "keypress":
                keys = action.get("keys", [])
                for k in keys:
                    mapped = translate_key(k)
                    await page.keyboard.press(mapped)

            elif action_type == "wait":
                ms = action.get("ms", 1000)
                await asyncio.sleep(ms / 1000.0)

            elif action_type == "move":
                x, y = action.get("x", 0), action.get("y", 0)
                await page.mouse.move(x, y)

            elif action_type == "drag":
                path = action.get("path", [])
                if not path:
                    raise ValueError("No path provided for drag action.")
                first = path[0]
                await page.mouse.move(first[0], first[1])
                await page.mouse.down()
                for pt in path[1:]:
                    await page.mouse.move(pt[0], pt[1])
                await page.mouse.up()

            elif action_type == "back":
                await page.go_back()

            elif action_type == "forward":
                await page.go_forward()

            elif action_type == "goto":
                url = action.get("url")
                if not url:
                    raise ValueError("URL is required for goto action.")
                await page.goto(url, wait_until="networkidle")

            elif action_type == "screenshot":
                # We do nothing here because screenshot is done automatically after the action
                pass

            else:
                self.logger.warning(f"Unknown action type: {action_type}")

            # After action, take screenshot
            screenshot_data = await page.screenshot(full_page=False)
            data64 = base64.b64encode(screenshot_data).decode("utf-8")
            current_url = page.url if not page.is_closed() else "about:blank"

            return {
                "type": "image",
                "source": {
                    "media_type": "image/png",
                    "data": data64
                },
                "current_url": current_url,
                "tool_name": action_type,
                "tool_args": action,
            }

        except Exception as e:
            self.logger.error(f"Error executing action '{action_type}': {e}")
            return {
                "type": "error",
                "error": str(e),
                "tool_name": action_type,
                "tool_args": action,
            }
            
    async def cleanup(self) -> None:
        """Close all browser contexts and pages properly."""
        # Prevent multiple cleanups
        if self._cleanup_done:
            self.logger.info("Cleanup already performed, skipping")
            return
            
        self._cleanup_done = True
        self.logger.info("Starting browser cleanup")
        
        try:
            # First, cancel any pending tasks we're tracking
            for task in self._pending_tasks:
                if not task.done():
                    task.cancel()
            
            # Wait for a short time to let tasks properly cancel
            if self._pending_tasks:
                pending = list(self._pending_tasks)
                self.logger.info(f"Waiting for {len(pending)} pending tasks to complete")
                try:
                    # Wait for tasks with a timeout
                    await asyncio.wait(pending, timeout=1.0)
                except asyncio.CancelledError:
                    self.logger.warning("Task cancellation was itself cancelled")
                    pass
            
            # Remove our page event handlers to prevent new callbacks
            if hasattr(self.context, "_listeners"):
                self.logger.info("Removing page event handlers")
                self.context.remove_listener("page", self._handle_new_page)
            
            # First close all pages explicitly except active page
            for page in list(self._setup_pages):
                if page != self.active_page and not page.is_closed():
                    try:
                        await page.close()
                    except Exception as e:
                        self.logger.warning(f"Error closing page: {e}")
            
            # Close active page last
            if self.active_page and not self.active_page.is_closed():
                try:
                    await self.active_page.close()
                except Exception as e:
                    self.logger.warning(f"Error closing active page: {e}")
            
            # Now close all contexts explicitly
            try:
                await self.context.close()
            except Exception as e:
                self.logger.warning(f"Error closing context: {e}")
                
            # Finally close the browser
            try:
                await self.browser.close()
                self.logger.info("Browser closed successfully")
            except Exception as e:
                self.logger.warning(f"Error during browser close: {e}")
                
        except Exception as e:
            self.logger.error(f"Error during browser cleanup: {e}")
            import traceback
            self.logger.error(traceback.format_exc()) 