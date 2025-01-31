import datetime
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Mapping,
    Iterator,
    Optional,
    Sequence,
    Type,
    Union,
    AsyncIterator,
)
from langchain_core.messages import ToolMessage
from functools import cached_property
import asyncio
from api.utils.prompt import chat_dict_to_base_messages
from .tools import (
    GoToUrlTool,
    GetCurrentUrlTool,
    ClaudeComputerTool,
    GoToUrlParams,
    GetCurrentUrlParams,
    SaveToMemoryTool,
    WaitTool,
)
from ...providers import create_llm
from ...models import ModelConfig, ModelProvider
from steel import Steel
from playwright.async_api import async_playwright
import anthropic
from langchain_anthropic import ChatAnthropic
from langchain_anthropic.chat_models import convert_to_anthropic_tool
from langchain_core.tools import BaseTool
from functools import cached_property
import anthropic
import os
from ...models import ModelConfig, ModelProvider
from dotenv import load_dotenv
from ...utils.types import AgentSettings
from langchain.schema import SystemMessage, BaseMessage
import copy

load_dotenv(".env.local")

STEEL_API_KEY = os.getenv("STEEL_API_KEY")
STEEL_CONNECT_URL = os.getenv("STEEL_CONNECT_URL")
STEEL_API_URL = os.getenv("STEEL_API_URL")


def trim_images_from_messages(
    messages: List[BaseMessage], num_images_to_keep: int
) -> List[BaseMessage]:
    """
    Trim images from message history keeping only the N most recent ones.
    Replaces removed images with placeholder text.

    Args:
        messages: List of messages containing tool results with images
        num_images_to_keep: Number of most recent images to keep

    Returns:
        Messages with excess images removed
    """
    if not num_images_to_keep or num_images_to_keep < 0:
        return messages

    # Find all tool messages with images, starting from most recent
    image_messages = []
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            contents = msg.content if isinstance(
                msg.content, list) else [msg.content]
            has_image = any(
                c.get("type") == "image" for c in contents if isinstance(c, dict)
            )
            if has_image:
                image_messages.append(msg)

    if len(image_messages) <= num_images_to_keep:
        return messages

    messages_copy = copy.deepcopy(messages)
    keep_count = num_images_to_keep

    # Process messages from oldest to newest
    for msg in messages_copy:
        if not isinstance(msg, ToolMessage):
            continue

        if isinstance(msg.content, list):
            new_content = []
            for content in msg.content:
                if isinstance(content, dict) and content.get("type") == "image":
                    if keep_count > 0:
                        new_content.append(content)
                        keep_count -= 1
                    else:
                        # Replace image with placeholder
                        new_content.append(
                            {
                                "type": "text",
                                "text": "[Previous image removed to conserve context window]",
                            }
                        )
                else:
                    new_content.append(content)
            msg.content = new_content
        elif isinstance(msg.content, dict) and msg.content.get("type") == "image":
            if keep_count > 0:
                keep_count -= 1
            else:
                msg.content = {
                    "type": "text",
                    "text": "[Previous image removed to conserve context window]",
                }

    return messages_copy


class BetaChatAnthropic(ChatAnthropic):
    """ChatAnthropic that uses the beta.messages endpoint for computer-use."""

    @cached_property
    def _client(self) -> anthropic.Client:
        client = super()._client
        # Force use of beta client for all messages
        client.messages = client.beta.messages
        return client

    @cached_property
    def _async_client(self) -> anthropic.AsyncClient:
        client = super()._async_client
        # Force use of beta client for all messages
        client.messages = client.beta.messages
        return client

    def bind_tools(
        self,
        tools: Sequence[Union[Dict[str, Any], Type, Callable, BaseTool]],
        **kwargs: Any,
    ):
        """Override bind_tools to handle Anthropic-specific tool formats"""
        # Pass tools directly if they're in Anthropic format
        anthropic_tools = []
        for tool in tools:
            if isinstance(tool, dict) and "type" in tool:
                # Already in Anthropic format, pass through
                anthropic_tools.append(tool)
            else:
                # Use default conversion for standard tools
                anthropic_tools.append(convert_to_anthropic_tool(tool))

        return super().bind(tools=anthropic_tools, **kwargs)


async def claude_steel_agent(
    model_config: ModelConfig,
    agent_settings: AgentSettings,
    history: List[Mapping[str, Any]],
    session_id: str,
    cancel_event: Optional[asyncio.Event] = None,
) -> AsyncIterator[str]:
    """
    Create and return an agent that can use the defined tools.
    We can use a LangChain agent that can parse tool usage from the model.
    """

    client = Steel(
        steel_api_key=STEEL_API_KEY,
        base_url=STEEL_API_URL,
    )
    print("Steel client initialized successfully")  # Debug log

    print("Creating Steel session...")  # Debug log
    session = client.sessions.retrieve(session_id)
    print(f"Session retrieved successfully with Session ID: {session.id}.")
    print(f"You can view the session live at {session.session_viewer_url}\n")

    print("Connecting to Playwright...")  # Debug log
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(f"{STEEL_CONNECT_URL}?apiKey={STEEL_API_KEY}&sessionId={session.id}")
        print("Playwright connected successfully")  # Debug log

        print("Creating page at existing context...")  # Debug log
        current_context = browser.contexts[0]
        page = current_context.pages[0]
        await page.set_viewport_size({"width": 1280, "height": 800})
        print("Page created successfully")  # Debug log

        tools_to_use = {
            "go_to_url": GoToUrlTool(
                page, wait_time=agent_settings.wait_time_between_steps
            ),
            "get_current_url": GetCurrentUrlTool(page),
            "save_to_memory": SaveToMemoryTool(),
            "computer": ClaudeComputerTool(
                page, wait_time=agent_settings.wait_time_between_steps
            ),
            "wait": WaitTool(page),
        }
        computer_tools = [
            {
                "type": "computer_20241022",
                "name": "computer",
                "display_width_px": 1280,
                "display_height_px": 800,
                "display_number": 1,
            },
            {
                "name": "go_to_url",
                "description": "Navigate to the specified URL, optionally waiting a given number of ms, and return a base64 screenshot.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The URL to navigate to",
                        },
                        "wait_time": {
                            "type": "integer",
                            "description": "Time in ms to wait before screenshot",
                            "default": 2000,
                        },
                    },
                    "required": ["url"],
                },
            },
            {
                "name": "get_current_url",
                "description": "Returns the current URL of the provided page, with no arguments required.",
                "input_schema": {"type": "object", "properties": {}},
            },
            {
                "name": "save_to_memory",
                "description": "Accepts a string 'information' and simulates saving it to memory. Returns a success message.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "information": {
                            "type": "string",
                            "description": "The information to save to memory",
                        }
                    },
                    "required": ["information"],
                },
            },
            {
                "name": "wait",
                "description": "Wait for a specified number of seconds before continuing. Useful when waiting for page loads or animations to complete.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "seconds": {
                            "type": "number",
                            "description": "Number of seconds to wait",
                            "minimum": 0,
                            "maximum": 30,
                            "default": 2,
                        }
                    },
                    "required": ["seconds"],
                },
            },
        ]

        try:
            print("Initializing claude_steel_agent...")  # Debug log
            llm = create_llm(
                ModelConfig(
                    provider=ModelProvider.ANTHROPIC_COMPUTER_USE,
                    model_name="claude-3-5-sonnet-20241022",
                    temperature=model_config.temperature,
                    max_tokens=model_config.max_tokens,
                    api_key=model_config.api_key,
                    extra_headers={
                        "anthropic-beta": "computer-use-2024-10-22"},
                )
            )
            print("LLM initialized successfully")  # Debug log
            tool_definitions = tools_to_use
            tools = list(tool_definitions.values())
            tools.append(computer_tools)
            print("Binding tools to the LLM...")  # Debug log
            llm_with_tools = llm.bind_tools(computer_tools)
            print("Tools bound successfully")  # Debug log

            print("Converting chat history to base messages...")  # Debug log
            base_messages = chat_dict_to_base_messages(history)

            # Add system message if provided in agent_settings
            if agent_settings.system_prompt:
                agent_settings.system_prompt += f"\nCurrent date and time: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                base_messages.insert(
                    0, SystemMessage(content=agent_settings.system_prompt)
                )

            print(f"Base messages created")  # Debug log

            while True:
                # Check if user/server requested cancellation
                if cancel_event and cancel_event.is_set():
                    break

                first = True
                gathered = None

                # Stream partial chunks (tokens or text) from the LLM, which can also
                # contain references to tool calls (gathered.tool_calls)
                async for chunk in llm_with_tools.astream(base_messages):
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
                if gathered and getattr(gathered, "tool_calls", None):
                    tools_called = gathered.tool_calls
                else:
                    tools_called = []

                if tools_called:
                    for tool in tools_called:
                        result = await tool_definitions[tool["name"]].ainvoke(
                            tool["args"]
                        )
                        message = ToolMessage(
                            content=[result], tool_call_id=tool["id"])
                        
                        yield message
                        base_messages.append(message)
                else:
                    break
        except Exception as e:
            print(f"Error in claude_steel_agent: {str(e)}")
            raise


def main():
    print("Starting main function...")  # Debug log

    model_config = ModelConfig(
        model_name="claude-3-5-sonnet-20241022",
        temperature=0,
        provider=ModelProvider.ANTHROPIC,
    )

    history = [
        {
            "role": "user",
            "content": "1. use your go_to_url tool go to bing.com and 2. search for 'best thai in toronto'",
        }
    ]

    print("Calling base_agent...")  # Debug log
    import asyncio

    try:

        async def run_agent():
            async for response_chunk in claude_steel_agent(model_config, history):
                print(response_chunk, end="", flush=True)

        asyncio.run(run_agent())

    except Exception as e:
        print(f"Error occurred: {str(e)}")


if __name__ == "__main__":
    print("Script is being run directly")  # Debug log
    main()
