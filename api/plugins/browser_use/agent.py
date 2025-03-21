import logging
from browser_use import Agent, Browser, BrowserConfig, Controller
from typing import Any, List, Mapping, AsyncIterator, Optional, Dict
from ...providers import create_llm
from ...models import ModelConfig
from langchain.schema import AIMessage
from langchain_core.messages import ToolMessage
import os
from dotenv import load_dotenv
from ...utils.types import AgentSettings
from browser_use.browser.views import BrowserState
from browser_use.browser.context import BrowserContext
from browser_use.agent.views import (
    AgentHistoryList,
    AgentOutput,
)
import asyncio
from pydantic import BaseModel
import uuid
from .system_prompt import ExtendedSystemPrompt

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(".env.local")
os.environ["ANONYMIZED_TELEMETRY"] = "false"

STEEL_API_KEY = os.getenv("STEEL_API_KEY")
STEEL_CONNECT_URL = os.getenv("STEEL_CONNECT_URL")

# Dictionary to store active browser instances by session_id
active_browsers: Dict[str, Browser] = {}
active_browser_contexts: Dict[str, BrowserContext] = {}

# Global variable to track resume state
_agent_resumed = False

# Initialize the controller
class SessionAwareController(Controller):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.session_id = None
        self.agent = None

    def set_session_id(self, session_id: str):
        self.session_id = session_id

    def set_agent(self, agent: Agent):
        self.agent = agent

controller = SessionAwareController(exclude_actions=["open_tab", "switch_tab"])

@controller.action('Print a message')
def print_call(message: str) -> str:
    """Print a message when the tool is called."""
    print(f"🔔 Tool call: {message}")
    return f"Printed: {message}"

@controller.action('Pause execution')
async def pause_execution(reason: str) -> str:
    """Pause execution using agent's pause mechanism."""
    if not controller.agent:
        raise ValueError("No agent set in controller")
        
    print(f"⏸️ Pausing execution: {reason}")
    
    # Store current browser state before pausing (to prevent about:blank issue)
    browser_context = None
    browser = None
    if controller.session_id in active_browser_contexts:
        browser_context = active_browser_contexts[controller.session_id]
    if controller.session_id in active_browsers:
        browser = active_browsers[controller.session_id]
    
    # Log the current state for debugging
    if browser:
        print(f"📊 Current browser state before pause - session_id: {controller.session_id}")
        
    # Pause the agent but ensure browser state is preserved
    controller.agent.pause()
    
    # Make sure browser and context remain active and are not reset
    if controller.session_id:
        active_browser_contexts[controller.session_id] = browser_context
        active_browsers[controller.session_id] = browser
    
    return "Agent paused"

class ResumeRequest(BaseModel):
    session_id: str

async def resume_execution(request: ResumeRequest) -> dict:
    """API endpoint to resume agent execution."""
    global _agent_resumed
    if not controller.agent:
        return {"status": "error", "message": "No agent found"}
    
    # Ensure browser state is preserved
    session_id = request.session_id
    if session_id in active_browsers and session_id in active_browser_contexts:
        logger.info(f"📊 Preserving browser state for session on resume: {session_id}")
        browser = active_browsers[session_id]
        browser_context = active_browser_contexts[session_id]
        
        # Make sure we're still using the same browser instances
        if controller.agent.browser != browser:
            logger.info(f"🔄 Restoring browser instance for session: {session_id}")
            controller.agent.browser = browser
            
        if controller.agent.browser_context != browser_context:
            logger.info(f"🔄 Restoring browser context for session: {session_id}")
            controller.agent.browser_context = browser_context
    
    # Resume the agent
    controller.agent.resume()
    _agent_resumed = True
    
    return {"status": "success", "message": "Agent resumed"}

class PauseRequest(BaseModel):
    session_id: str

async def pause_execution_manually(request: PauseRequest) -> dict:
    """API endpoint to manually pause agent execution."""
    logger.info(f"🖐️ Manual pause requested for session: {request.session_id}")
    
    if not controller.agent:
        return {"status": "error", "message": "No agent found"}
    
    if controller.session_id != request.session_id:
        return {"status": "error", "message": "Session ID mismatch"}
    
    # Store current browser state before pausing
    browser_context = None
    browser = None
    if controller.session_id in active_browser_contexts:
        browser_context = active_browser_contexts[controller.session_id]
    if controller.session_id in active_browsers:
        browser = active_browsers[controller.session_id]
    
    # Log the current state for debugging
    if browser:
        logger.info(f"📊 Preserving browser state on manual pause - session_id: {controller.session_id}")
    
    # Pause the agent but ensure browser state is preserved
    controller.agent.pause()
    
    # Make sure browser and context remain active and are not reset
    if controller.session_id:
        active_browser_contexts[controller.session_id] = browser_context
        active_browsers[controller.session_id] = browser
    
    return {"status": "success", "message": "Agent manually paused for user control"}

async def browser_use_agent(
    model_config: ModelConfig,
    agent_settings: AgentSettings,
    history: List[Mapping[str, Any]],
    session_id: str,
    cancel_event: Optional[asyncio.Event] = None,
) -> AsyncIterator[str]:
    global _agent_resumed
    
    logger.info("🚀 Starting browser_use_agent with session_id: %s", session_id)
    logger.info("🔧 Model config: %s", model_config)
    logger.info("⚙️ Agent settings: %s", agent_settings)

    llm, use_vision = create_llm(model_config)
    logger.info("🤖 Created LLM instance")

    # Set the session_id in the controller
    controller.set_session_id(session_id)
    
    # Reset the resumed flag at the start of a new session
    _agent_resumed = False

    browser = None
    browser_context = None
    queue = asyncio.Queue()

    # Check if we already have a browser for this session
    if session_id in active_browsers:
        logger.info("🔄 Reusing existing browser for session: %s", session_id)
        browser = active_browsers[session_id]
        browser_context = active_browser_contexts[session_id]
    else:
        # Create a new browser instance
        logger.info("🌐 Creating new browser for session: %s", session_id)
        browser = Browser(
            BrowserConfig(
                cdp_url=f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session_id}"
            )
        )
        # Use our custom browser context instead of the default one.
        browser_context = BrowserContext(browser=browser)
        
        # Store for future use
        active_browsers[session_id] = browser
        active_browser_contexts[session_id] = browser_context

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

    agent = Agent(
        llm=llm,
        task=history[-1]["content"],
        controller=controller,
        browser=browser,
        browser_context=browser_context,
        generate_gif=False,
        use_vision=use_vision,
        register_new_step_callback=yield_data,
        register_done_callback=yield_done,
        system_prompt_class=ExtendedSystemPrompt,
    )
    logger.info("🌐 Created Agent with browser instance (use_vision=%s)", use_vision)

    # Set the agent in the controller
    controller.set_agent(agent)

    steps = agent_settings.steps or 25

    agent_task = asyncio.create_task(agent.run(steps))
    logger.info("▶️ Started agent task with %d steps", steps)

    # Store special messages until agent is resumed
    pending_special_messages = []
    
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
            
            # Check if agent was resumed - if so, release any pending special messages
            if _agent_resumed and pending_special_messages:
                # First yield all pending special messages
                for msg in pending_special_messages:
                    yield msg
                pending_special_messages = []  # Clear the pending messages
            
            # If this is a special message (Memory, Next Goal, etc)
            if isinstance(data, AIMessage) and data.content and (
                "*Memory*:" in data.content or 
                "*Next Goal*:" in data.content or 
                "*Previous Goal*:" in data.content
            ):
                if _agent_resumed:
                    # If agent is resumed, send the message immediately
                    yield data
                else:
                    # Otherwise, store it for later
                    pending_special_messages.append(data)
            else:
                # Always yield non-special messages
                yield data
    finally:
        # if browser:
        #     print("Closing browser...")
        #     try:
        #         await browser.close()
        #         print("Browser closed.")
        #     except Exception as e:
        #         print(f"Error closing browser: {e}")
        # # Cleanup code here
        # pending_tasks = [t for t in asyncio.all_tasks(
        # ) if t is not asyncio.current_task()]
        # if pending_tasks:
        #     print(f"Cancelling {len(pending_tasks)} pending tasks...")
        #     for t in pending_tasks:
        #         t.cancel()
        #     await asyncio.gather(*pending_tasks, return_exceptions=True)
        pass
