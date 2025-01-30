from typing import Any
from anthropic import Client
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_core.language_models.chat_models import BaseChatModel
from .models import ModelConfig, ModelProvider
from typing import Sequence, Union, Dict, Type, Callable, Any
from langchain_core.tools import BaseTool
from langchain_anthropic.chat_models import convert_to_anthropic_tool
from functools import cached_property
import anthropic


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


def create_llm(config: ModelConfig) -> BaseChatModel | Client:
    """
    Returns the appropriate LangChain LLM object based on the ModelConfig provider.
    You can expand this to handle additional providers.
    """
    if config.provider == ModelProvider.OPENAI:
        return ChatOpenAI(
            model_name=config.model_name or "gpt-4o-mini",
            temperature=config.temperature,
            max_tokens=config.max_tokens,
            **config.extra_params,
        )
    elif config.provider == ModelProvider.ANTHROPIC:
        return ChatAnthropic(
            model=config.model_name or "claude-3-5-sonnet-latest",
            max_tokens_to_sample=config.max_tokens,
            temperature=config.temperature,
            **config.extra_params,

        )
    elif config.provider == ModelProvider.ANTHROPIC_COMPUTER_USE:
        return BetaChatAnthropic(
            model=config.model_name or "claude-3-5-sonnet-20241022",
            max_tokens_to_sample=config.max_tokens,
            temperature=config.temperature,
            **config.extra_params,
        )
    else:
        raise ValueError(f"Unsupported provider: {config.provider}")
