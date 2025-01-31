from browser_use import Agent, Browser, BrowserConfig
from typing import Any, List, Mapping, AsyncIterator, Optional
from ...providers import create_llm
from ...models import ModelConfig
from langchain.schema import AIMessage
from langchain_core.messages import ToolCall, ToolMessage
import os
from dotenv import load_dotenv
from ...utils.types import AgentSettings
import asyncio

load_dotenv(".env.local")

STEEL_API_KEY = os.getenv("STEEL_API_KEY")
STEEL_CONNECT_URL = os.getenv("STEEL_CONNECT_URL")


async def browser_use_agent(
    model_config: ModelConfig,
    agent_settings: AgentSettings,
    history: List[Mapping[str, Any]],
    session_id: str,
    cancel_event: Optional[asyncio.Event] = None,
) -> AsyncIterator[str]:

    llm = create_llm(model_config)
    agent = Agent(
        llm=llm,
        task=history[-1]["content"],
        browser=Browser(
            BrowserConfig(
                cdp_url=f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session_id}"
            )
        ),
    )
    agent_task = asyncio.create_task(agent.run(agent_settings.steps))
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
        for thought in thoughts[last_thought_index + 1 :]:
            if last_thought_index > -1:  # Skip for first thought
                yield AIMessage(content=thought.evaluation_previous_goal)
                yield {"stop": True}
            yield AIMessage(content=thought.next_goal)
            yield {"stop": True}
        last_thought_index = len(thoughts) - 1 if thoughts else -1

        # Process all new actions
        actions = agent.history.model_actions()
        if actions[last_action_index + 1 :]:
            tool_calls = []
            print(f"New actions: {len(actions[last_action_index + 1 :])}")
            for action in actions[last_action_index + 1 :]:
                if not action.get("done"):
                    for index, key in enumerate(action.keys()):
                        tool_call_id = f"tool_call_{id + index}"
                        tool_calls.append(
                            ToolCall(name=key, args=action[key], id=tool_call_id)
                        )
                        last_tool_call_ids.append(tool_call_id)
                        id += 1
            tool_call_message = AIMessage(content="", tool_calls=tool_calls)
            print(f"Tool call length: {len(tool_call_message.tool_calls)}")
            yield tool_call_message
        last_action_index = len(actions) - 1 if actions else -1

        # Process all new results
        results = agent.history.action_results()
        for result in results[last_result_index + 1 :]:
            if result.is_done:
                yield AIMessage(content=result.extracted_content)
                finished = True
                break
            if last_tool_call_ids:
                yield ToolMessage(
                    content=str(result.extracted_content),
                    tool_call_id=last_tool_call_ids.pop(0),
                )
        last_result_index = len(results) - 1 if results else -1
        if finished and agent_task.done():
            break
        if agent.consecutive_failures == agent.max_failures:
            break
        if cancel_event and cancel_event.is_set():
            agent.stop()
            agent_task.cancel()
            break
        await asyncio.sleep(0.001)
