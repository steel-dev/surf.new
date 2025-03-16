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
from pydantic import ValidationError, BaseModel
import uuid
from ...plugins.base.tools import get_available_tools
from .system_prompt import LoggingSystemPrompt

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(".env.local")
os.environ["ANONYMIZED_TELEMETRY"] = "false"

STEEL_API_KEY = os.getenv("STEEL_API_KEY")
STEEL_CONNECT_URL = os.getenv("STEEL_CONNECT_URL")

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
    controller.agent.pause()
    return "Agent paused"

# Add a global to track resume state
_agent_resumed = False

class ResumeRequest(BaseModel):
    session_id: str

async def resume_execution(request: ResumeRequest) -> dict:
    """API endpoint to resume agent execution."""
    global _agent_resumed
    if not controller.agent:
        return {"status": "error", "message": "No agent found"}
    
    controller.agent.resume()
    _agent_resumed = True
    return {"status": "success", "message": "Agent resumed"}

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

    llm, use_vision = create_llm(model_config)
    logger.info("🤖 Created LLM instance")

    # Set the session_id in the controller
    controller.set_session_id(session_id)

    browser = None
    queue = asyncio.Queue()

    # Use our custom browser class
    browser = Browser(
        BrowserConfig(
            cdp_url=f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session_id}"
        )
    )
    # Use our custom browser context instead of the default one.
    browser_context = BrowserContext(browser=browser)

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
        system_prompt_class=LoggingSystemPrompt,  # Pass the class, not an instance
    )
    logger.info("🌐 Created Agent with browser instance (use_vision=%s)", use_vision)

    # Set the agent in the controller
    controller.set_agent(agent)

    # Create initial safety pause using the same pattern as in yield_data
    tool_calls = []
    tool_outputs = []
    safety_check_complete = False

    # Add pause_execution first
    pause_id = f"tool_call_{uuid.uuid4()}"
    pause_tool_call = {
        "name": "pause_execution",
        "args": {"reason": "⏸️ Click 'Resume' to allow the agent to start browsing"},
        "id": pause_id
    }

    # Send the pause message first
    asyncio.get_event_loop().call_soon_threadsafe(
        queue.put_nowait,
        AIMessage(content="", tool_calls=[pause_tool_call])
    )
    asyncio.get_event_loop().call_soon_threadsafe(
        queue.put_nowait,
        ToolMessage(content="", tool_call_id=pause_id)
    )
    asyncio.get_event_loop().call_soon_threadsafe(
        queue.put_nowait,
        {"stop": True}
    )

    # Add print_call second
    print_id = f"tool_call_{uuid.uuid4()}"
    print_tool_call = {
        "name": "print_call",
        "args": {"message": "⚠️ BROWSER SAFETY: This agent requires verification before proceeding"},
        "id": print_id
    }
    tool_calls.append(print_tool_call)
    tool_outputs.append(ToolMessage(content="", tool_call_id=print_id))

    # Send the print message second
    asyncio.get_event_loop().call_soon_threadsafe(
        queue.put_nowait,
        AIMessage(content="", tool_calls=[print_tool_call])
    )
    asyncio.get_event_loop().call_soon_threadsafe(
        queue.put_nowait,
        tool_outputs[0]
    )
    asyncio.get_event_loop().call_soon_threadsafe(
        queue.put_nowait,
        {"stop": True}
    )

    # Execute the actual tools in the same order
    await pause_execution("⏸️ Click 'Resume' to allow the agent to start browsing")
    print_call("⚠️ BROWSER SAFETY: This agent requires verification before proceeding")
    safety_check_complete = True

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
            global _agent_resumed
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
