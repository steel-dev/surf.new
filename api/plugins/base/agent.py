from typing import Any, List, Mapping, AsyncIterator, Optional
import asyncio

from langchain_core.messages import ToolMessage
from api.utils.prompt import chat_dict_to_base_messages
from .tools import get_available_tools
from ...providers import create_llm
from ...models import ModelConfig
from ...utils.types import AgentSettings


async def base_agent(
    model_config: ModelConfig,
    agent_settings: AgentSettings,
    history: List[Mapping[str, Any]],
    session_id: str,
    cancel_event: Optional[asyncio.Event] = None,
) -> AsyncIterator[str]:
    """
    Create and return an async agent that can use the defined tools.
    We can use a LangChain agent that can parse tool usage from the model.
    If cancel_event is provided, we check it after each chunk/tool invocation.
    """

    llm = create_llm(model_config)
    tool_definitions = get_available_tools()
    tools = list(tool_definitions.values())

    base_messages = chat_dict_to_base_messages(history)

    while True:
        if cancel_event and cancel_event.is_set():
            break

        first = True
        gathered = None

        # Stream partial chunks from the LLM
        async for chunk in llm.bind_tools(tools).astream(input=base_messages):
            # Check for cancellation between tokens
            if cancel_event and cancel_event.is_set():
                break

            if first:
                gathered = chunk
                first = False
            else:
                gathered = gathered + chunk

            yield chunk

        if not gathered:
            # No chunks arrived, end loop
            break

        base_messages.append(gathered)

        if cancel_event and cancel_event.is_set():
            # If canceled after LLM chunk loop
            break

        # Handle any tool calls
        if getattr(gathered, "tool_calls", None):
            for tool in gathered.tool_calls:
                if cancel_event and cancel_event.is_set():
                    break
                result = await tool_definitions[tool["name"]].ainvoke(tool["args"])
                msg = ToolMessage(result, tool_call_id=tool["id"])
                yield msg
                base_messages.append(msg)
        else:
            break
