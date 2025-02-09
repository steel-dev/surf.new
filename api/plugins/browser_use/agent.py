import logging
from browser_use import Agent, Browser, BrowserConfig, Controller
from typing import Any, List, Mapping, AsyncIterator, Optional
from ...providers import create_llm
from ...models import ModelConfig
from langchain.schema import AIMessage
from langchain_core.messages import ToolCall, ToolMessage, BaseMessage
import os
from dotenv import load_dotenv
from ...utils.types import AgentSettings
from browser_use.browser.views import BrowserState
from browser_use.browser.context import BrowserContext, BrowserSession
from browser_use.agent.views import (
    ActionResult,
    AgentError,
    AgentHistory,
    AgentHistoryList,
    AgentOutput,
    AgentStepInfo,
)
import asyncio
from pydantic import ValidationError
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(".env.local")
os.environ["ANONYMIZED_TELEMETRY"] = "false"

STEEL_API_KEY = os.getenv("STEEL_API_KEY")
STEEL_CONNECT_URL = os.getenv("STEEL_CONNECT_URL")
class CustomBrowser(Browser):
    async def close(self):
        # Override close to do nothing
        logger.info("CustomBrowser.close() overridden; not closing browser.")
        # Instead of closing, simply clear internal references
        self.playwright_browser = None
        self.playwright = None

    def __del__(self):
        # Override __del__ to avoid any async cleanup
        logger.info("CustomBrowser.__del__() overridden; cleanup skipped.")
        pass

class CustomBrowserContext(BrowserContext):
    async def close(self):
        logger.debug("CustomBrowserContext.close() overridden; skipping cleanup.")
        # Do nothing so the underlying page stays active
        pass

    def __del__(self):
        logger.debug("CustomBrowserContext.__del__() overridden; skipping cleanup.")
        pass

    # Optionally override the async context manager exit if used
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        logger.debug("CustomBrowserContext.__aexit__() overridden; not closing context.")
        # Do not call the parent __aexit__; simply pass.
        pass

    # You may also want to override _initialize_session if you want to ensure
    # the initial state is created but nothing is cleaned up later.
    async def _initialize_session(self):
        logger.debug("CustomBrowserContext._initialize_session() overridden.")
        playwright_browser = await self.browser.get_playwright_browser()
        context = await self._create_context(playwright_browser)
        self._add_new_page_listener(context)
        # Reuse the last page if available; otherwise create one.
        if context.pages:
            page = context.pages[-1]
        else:
            page = await context.new_page()
        initial_state = self._get_initial_state(page)
        self.session = BrowserSession(
            context=context,
            current_page=page,
            cached_state=initial_state,
        )
        return self.session

class CustomAgent(Agent):
    async def run(self, max_steps: int = 100) -> "AgentHistoryList":
        try:
            # Execute the standard run behavior.
            history = await super().run(max_steps)
            return history
        finally:
            # Instead of closing the browser and context,
            # log a message and do nothing.
            self._paused = False  # or any flag resets you might need
            # ***DON'T*** call close() on browser_context or browser.
            self._log_cleanup_skipped()
    
    def _log_cleanup_skipped(self):
        import logging
        logging.getLogger(__name__).info(
            "CustomAgent cleanup skipped; browser and context remain open."
        )

async def browser_use_agent(
    model_config: ModelConfig,
    agent_settings: AgentSettings,
    history: List[Mapping[str, Any]],
    session_id: str,
    cancel_event: Optional[asyncio.Event] = None,
) -> AsyncIterator[str]:
    logger.info("🚀 Starting browser_use_agent with session_id: %s", session_id)
    logger.info("🔧 Model config: %s", model_config)
    logger.info("⚙️ Agent settings: %s", agent_settings)

    llm = create_llm(model_config)
    logger.info("🤖 Created LLM instance")

    controller = Controller(exclude_actions=["open_tab", "switch_tab"])

    queue = asyncio.Queue()

    def yield_data(
        browser_state: "BrowserState", agent_output: "AgentOutput", step_number: int
    ):
        """Callback function for each step"""
        if step_number > 2:
            asyncio.get_event_loop().call_soon_threadsafe(
                queue.put_nowait,
                AIMessage(
                    content=f"*Previous Goal*:\n{agent_output.current_state.evaluation_previous_goal}"
                ),
            )
            asyncio.get_event_loop().call_soon_threadsafe(
                queue.put_nowait, {"stop": True}
            )
        # format memory
        asyncio.get_event_loop().call_soon_threadsafe(
            queue.put_nowait,
            AIMessage(content=f"*Memory*:\n{agent_output.current_state.memory}"),
        )
        asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait, {"stop": True})
        # Format Next Goal
        asyncio.get_event_loop().call_soon_threadsafe(
            queue.put_nowait,
            AIMessage(content=f"*Next Goal*:\n{agent_output.current_state.next_goal}"),
        )
        asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait, {"stop": True})
        # format Tool calls (from actions)
        tool_calls = []
        tool_outputs = []
        for action_model in agent_output.action:
            for key, value in action_model.model_dump().items():
                if value:
                    if key == "done":
                        asyncio.get_event_loop().call_soon_threadsafe(
                            queue.put_nowait, AIMessage(content=value["text"])
                        )
                        asyncio.get_event_loop().call_soon_threadsafe(
                            queue.put_nowait, {"stop": True}
                        )
                    else:
                        id = uuid.uuid4()
                        value = {k: v for k, v in value.items() if v is not None}
                        tool_calls.append(
                            {"name": key, "args": value, "id": f"tool_call_{id}"}
                        )
                        tool_outputs.append(
                            ToolMessage(content="", tool_call_id=f"tool_call_{id}")
                        )

        asyncio.get_event_loop().call_soon_threadsafe(
            queue.put_nowait, AIMessage(content="", tool_calls=tool_calls)
        )
        for tool_output in tool_outputs:
            asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait, tool_output)

    def yield_done(history: "AgentHistoryList"):
        asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait, "END")

    # Use our custom browser class
    browser = CustomBrowser(
        BrowserConfig(
            cdp_url=f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session_id}"
        )
    )
    # Use our custom browser context instead of the default one.
    browser_context = CustomBrowserContext(browser=browser)

    agent = CustomAgent(
        llm=llm,
        task=history[-1]["content"],
        controller=controller,
        browser=browser,
        browser_context=browser_context,
        generate_gif=False,
        register_new_step_callback=yield_data,
        register_done_callback=yield_done,
    )
    logger.info("🌐 Created Agent with browser instance")

    steps = agent_settings.steps or 100

    agent_task = asyncio.create_task(agent.run(steps))
    logger.info("▶️ Started agent task with %d steps", steps)

    try:
        while True:
            if cancel_event and cancel_event.is_set():
                agent.stop()
                agent_task.cancel()
                break
            if agent._too_many_failures():
                break
            # Wait for data from the queue
            data = await queue.get()
            if data == "END":  # You'll need to send this when done
                break
            yield data
    finally:
        # Cleanup code here
        pass
