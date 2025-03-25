import logging
from browser_use import Agent, Browser, BrowserConfig, Controller
from typing import Any, List, Mapping, AsyncIterator, Optional, Dict
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
from queue import Queue, Empty
import threading

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(".env.local")
os.environ["ANONYMIZED_TELEMETRY"] = "false"

STEEL_API_KEY = os.getenv("STEEL_API_KEY")
STEEL_CONNECT_URL = os.getenv("STEEL_CONNECT_URL")

# Global agent manager to track active agents and their command queues
class AgentManager:
    def __init__(self):
        self.command_queues: Dict[str, Queue] = {}
        self.agents_paused: Dict[str, bool] = {}
        
    def register_agent(self, session_id: str, command_queue: Queue):
        logger.info(f"Registering agent for session {session_id}")
        self.command_queues[session_id] = command_queue
        self.agents_paused[session_id] = False
        
    def _is_valid_session(self, session_id: str) -> bool:
        """Helper method to check if a session ID is registered"""
        return session_id in self.command_queues
        
    def set_agent_paused(self, session_id: str, paused: bool) -> bool:
        """Update the pause state of an agent"""
        if not self._is_valid_session(session_id):
            return False
            
        logger.info(f"Setting agent {session_id} paused state to {paused}")
        self.agents_paused[session_id] = paused
        
        # Send the appropriate command if we're changing to paused or resumed state
        if paused:
            return self._send_command(session_id, {"type": "pause"})
        else:
            return self._send_command(session_id, {"type": "resume"})
        
    def is_agent_paused(self, session_id: str) -> bool:
        """Check if an agent is currently paused"""
        return self.agents_paused.get(session_id, False)
    
    def _send_command(self, session_id: str, command: dict) -> bool:
        """Helper method to send a command to an agent's queue"""
        if not self._is_valid_session(session_id):
            return False
            
        logger.info(f"Sending {command['type']} command to agent {session_id}")
        self.command_queues[session_id].put(command)
        return True
        
    def pause_agent(self, session_id: str) -> bool:
        """Pause an agent by sending the pause command and updating state"""
        return self.set_agent_paused(session_id, True)
        
    def resume_agent(self, session_id: str) -> bool:
        """Resume an agent by sending the resume command and updating state"""
        return self.set_agent_paused(session_id, False)
        
    def unregister_agent(self, session_id: str):
        """Remove an agent from the manager"""
        if session_id in self.command_queues:
            del self.command_queues[session_id]
        if session_id in self.agents_paused:
            del self.agents_paused[session_id]

# Create singleton instance
agent_manager = AgentManager()

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

    controller = Controller(exclude_actions=["open_tab", "switch_tab"])
    browser = None
    queue = asyncio.Queue()
    
    # Debug mode flags
    debug_mode = agent_settings.debug_mode or False
    debug_page_urls = agent_settings.debug_page_urls or []
    
    # Add a command queue for resume commands
    command_queue = Queue()
    
    # Register this agent with the global manager
    agent_manager.register_agent(session_id, command_queue)

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
            
        # Check if debug mode is enabled and current URL matches any debug URL
        if debug_mode and browser_state and browser_state.url:
            current_url = browser_state.url
            should_pause = False
            
            # Check if the current URL matches any of the debug URLs
            for debug_url in debug_page_urls:
                if debug_url.strip() in current_url:
                    should_pause = True
                    break
                    
            if should_pause and not agent_manager.is_agent_paused(session_id):
                agent_manager.pause_agent(session_id)
                
                # Notify that the agent is paused
                asyncio.get_event_loop().call_soon_threadsafe(
                    queue.put_nowait,
                    AIMessage(content=f"*Agent paused at URL*: {current_url}")
                )
                asyncio.get_event_loop().call_soon_threadsafe(
                    queue.put_nowait, {"stop": True}
                )

    def yield_done(history: "AgentHistoryList"):
        asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait, "END")

    # Use our custom browser class
    browser = Browser(
        BrowserConfig(
            cdp_url=f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session_id}"
        )
    )
    # Use our custom browser context instead of the default one.
    browser_context = BrowserContext(browser=browser)

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
    )
    logger.info("🌐 Created Agent with browser instance (use_vision=%s)", use_vision)

    steps = agent_settings.steps or 25

    agent_task = asyncio.create_task(agent.run(steps))
    logger.info("▶️ Started agent task with %d steps", steps)

    # Add a function to check for command queue messages
    def start_command_handler():
        while True:
            try:
                cmd = command_queue.get(timeout=0.5)
                if cmd.get("type") == "resume" and agent_manager.is_agent_paused(session_id):
                    agent.resume()
                    logger.info(f"Agent {session_id} resumed via command handler")
                elif cmd.get("type") == "pause" and not agent_manager.is_agent_paused(session_id):
                    agent.pause()
                    logger.info(f"Agent {session_id} paused via command handler")
            except Empty:
                # Check if we should exit the thread
                if getattr(threading.current_thread(), "stop_requested", False):
                    break
            except Exception as e:
                logger.error(f"Error in command handler: {e}")
                
    # Create and start the command handler thread
    command_thread = threading.Thread(target=start_command_handler)
    command_thread.daemon = True
    command_thread.start()

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
        # Unregister the agent from the global manager
        agent_manager.unregister_agent(session_id)
        # Signal the command thread to stop
        if command_thread and command_thread.is_alive():
            setattr(command_thread, "stop_requested", True)
        # Clean up resources as needed
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
