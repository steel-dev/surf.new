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


def print_step_data(browser_state: 'BrowserState', agent_output: 'AgentOutput', step_number: int):
    """Callback function for each step"""
    # print(f"\n=== Step {step_number} ===")
    # print(f"Current URL: {browser_state.url}")
    # print(f"Page Title: {browser_state.title}")
    # print(f"Agent's Next Goal: {agent_output.current_state.next_goal}")
    # print(f"Actions to take: {[a.model_dump() for a in agent_output.action]}")
    # print(f"Agent Output: {agent_output}")
    # Format Evaluation of previous goal
    yield AIMessage(content=agent_output.current_state.evaluation_previous_goal)
    # format memory
    yield AIMessage(content=agent_output.current_state.memory)
    # Format Next Goal
    yield AIMessage(content=agent_output.current_state.next_goal)
    # format Tool calls (from actions)
    tool_calls = []
    tool_outputs = []
    id = 0
    for key, value in agent_output.action.entries():
        if value:
            tool_calls.append(
                {"name": key, "args": value, "id": f"tool_call_{id}"})
            tool_outputs.append(ToolMessage(content="", id=f"tool_call_{id}"))
            id += 1

    yield AIMessage(content="", tool_calls=tool_calls)
    for tool_output in tool_outputs:
        yield tool_output


def print_final_results(history: 'AgentHistoryList'):
    """Callback function for when agent is done"""
    print("\n=== Final Results ===")
    print(f"History: {history}")
    print(f"Total steps taken: {len(history.history)}")
    print(f"Task completed successfully: {history.is_done()}")
    if history.errors():
        print(f"Errors encountered: {history.errors()}")


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

    controller = Controller(exclude_actions=['open_tab', 'switch_tab'])

    queue = asyncio.Queue()

    def yield_data(browser_state: 'BrowserState', agent_output: 'AgentOutput', step_number: int):
        """Callback function for each step"""
        if step_number > 2:
            asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait,  AIMessage(
                content=f"*Previous Goal*:\n{agent_output.current_state.evaluation_previous_goal}"))
            asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait, {"stop": True})
        # format memory
        asyncio.get_event_loop().call_soon_threadsafe(
            queue.put_nowait,  AIMessage(content=f"*Memory*:\n{agent_output.current_state.memory}"))
        asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait, {"stop": True})
        # Format Next Goal
        asyncio.get_event_loop().call_soon_threadsafe(
            queue.put_nowait,  AIMessage(content=f"*Next Goal*:\n{agent_output.current_state.next_goal}"))
        asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait, {"stop": True})
        # format Tool calls (from actions)
        tool_calls = []
        tool_outputs = []
        for action_model in agent_output.action:
            for (key, value) in action_model.model_dump().items():
                if value:
                    if key == "done":
                        asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait,  AIMessage(content=value["text"]))
                        asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait, {"stop": True})
                    else:
                        id = uuid.uuid4()
                        value = {k: v for k, v in value.items() if v is not None}
                        tool_calls.append(
                            {"name": key, "args": value, "id": f"tool_call_{id}"})
                        tool_outputs.append(ToolMessage(
                            content="", tool_call_id=f"tool_call_{id}"))

        asyncio.get_event_loop().call_soon_threadsafe(
            queue.put_nowait,  AIMessage(content="", tool_calls=tool_calls))
        for tool_output in tool_outputs:
            asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait, tool_output)

    def yield_done(history: 'AgentHistoryList'):
        asyncio.get_event_loop().call_soon_threadsafe(queue.put_nowait, "END")

    agent = Agent(
        llm=llm,
        task=history[-1]["content"],
        controller=controller,
        browser=Browser(
            BrowserConfig(cdp_url=f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session_id}")),
        generate_gif=False,
        register_new_step_callback=yield_data,
        register_done_callback=yield_done
    )
    logger.info("🌐 Created Agent with browser instance")

    agent_task = asyncio.create_task(agent.run(agent_settings.steps))
    logger.info("▶️ Started agent task with %d steps", agent_settings.steps)

    try:
        while True:
            # Wait for data from the queue
            data = await queue.get()
            if data == "END":  # You'll need to send this when done
                break
            yield data
    finally:
        # Cleanup code here
        pass
