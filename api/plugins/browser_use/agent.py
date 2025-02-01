import logging
from browser_use import Agent, Browser, BrowserConfig, Controller
from typing import Any, List, Mapping, AsyncIterator, Optional
from ...providers import create_llm
from ...models import ModelConfig
from langchain.schema import AIMessage
from langchain_core.messages import ToolCall, ToolMessage
import os
from dotenv import load_dotenv
from ...utils.types import AgentSettings
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(".env.local")
os.environ["ANONYMIZED_TELEMETRY"] = "false"

STEEL_API_KEY = os.getenv("STEEL_API_KEY")
STEEL_CONNECT_URL = os.getenv("STEEL_CONNECT_URL")


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


    agent = Agent(
        llm=llm,
        task=history[-1]["content"],
        controller=controller,
        browser=Browser(
            BrowserConfig(cdp_url=f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session_id}")
        ),
        generate_gif=False,
    )
    logger.info("🌐 Created Agent with browser instance")

    agent_task = asyncio.create_task(agent.run(agent_settings.steps))
    logger.info("▶️ Started agent task with %d steps", agent_settings.steps)

    last_thought_index = -1
    last_action_index = -1
    last_result_index = -1
    id = 0
    last_tool_call_ids = []
    finished = False
    tool_call_batches = []

    while True:
        # Process all new thoughts
        thoughts = agent.history.model_thoughts()
        for thought in thoughts[last_thought_index + 1:]:
            logger.info("💭 New thought: %s", thought.next_goal)
            if last_thought_index > -1:
                yield AIMessage(content=thought.evaluation_previous_goal)
                logger.info("📝 Yielded evaluation of previous goal")
                yield {"stop": True}
            yield AIMessage(content=thought.next_goal)
            logger.info("🎯 Yielded next goal")
            yield {"stop": True}
        last_thought_index = len(thoughts) - 1 if thoughts else -1

        # Process all new actions
        actions = agent.history.model_actions()
        if actions[last_action_index + 1:]:
            tool_calls = []
            logger.info("🔄 Processing %d new actions",
                        len(actions[last_action_index + 1:]))
            for action in actions[last_action_index + 1:]:
                if not action.get("done"):
                    for index, key in enumerate(action.keys()):
                        tool_call_id = f"tool_call_{id + index}"
                        tool_calls.append(
                            ToolCall(
                                name=key, args=action[key], id=tool_call_id)
                        )
                        last_tool_call_ids.append(tool_call_id)
                        id += 1
                        logger.info(
                            "🛠️ Created tool call: %s with id: %s", key, tool_call_id)
            tool_call_message = AIMessage(content="", tool_calls=tool_calls)
            logger.info("📤 Yielding tool call message with %d calls",
                        len(tool_call_message.tool_calls))
            yield tool_call_message
        last_action_index = len(actions) - 1 if actions else -1

        # Process all new results
        results = agent.history.action_results()
        for result in results[last_result_index + 1:]:
            if result.is_done:
                logger.info("✅ Task completed with result: %s",
                            result.extracted_content)
                yield AIMessage(content=result.extracted_content)
                finished = True
                break
            if last_tool_call_ids:
                logger.info("📥 Yielding tool result for id: %s",
                            last_tool_call_ids[0])
                yield ToolMessage(
                    content=str(result.extracted_content),
                    tool_call_id=last_tool_call_ids.pop(0)
                )
        last_result_index = len(results) - 1 if results else -1

        if finished and agent_task.done():
            logger.info("🏁 Agent task completed successfully")
            break
        if agent.consecutive_failures == agent.max_failures:
            logger.warning("⚠️ Agent reached maximum consecutive failures")
            break
        if cancel_event and cancel_event.is_set():
            logger.info("🛑 Agent task cancelled by user")
            agent.stop()
            agent_task.cancel()
            break
        await asyncio.sleep(0.001)
