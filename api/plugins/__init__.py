from enum import Enum, auto
from typing import (
    Callable,
    List,
    Mapping,
    Any,
    AsyncIterator,
    TypedDict,
    Union,
    Optional,
)
from ..models import ModelConfig, ModelProvider
from .base import base_agent
from .claude_computer_use import claude_computer_use
from .browser_use import browser_use_agent
from .openai_computer_use import openai_computer_use_agent
from ..utils.types import AgentSettings
from .claude_computer_use.prompts import SYSTEM_PROMPT

# from .example_plugin import example_agent


class WebAgentType(Enum):
    BASE = "base"
    EXAMPLE = "example"
    CLAUDE_COMPUTER_USE = "claude_computer_use"
    BROWSER_USE = "browser_use_agent"
    OPENAI_COMPUTER_USE = "openai_computer_use_agent"


class SettingType(Enum):
    INTEGER = "integer"
    FLOAT = "float"
    TEXT = "text"
    TEXTAREA = "textarea"


class SettingConfig(TypedDict):
    type: SettingType
    default: Union[int, float, str]
    min: Optional[Union[int, float]]
    max: Optional[Union[int, float]]
    step: Optional[Union[int, float]]
    maxLength: Optional[int]
    description: Optional[str]


# Agent configurations
AGENT_CONFIGS = {
    # WebAgentType.BASE.value: {
    #     "name": "Base Agent",
    #     "description": "A simple agent with basic functionality",
    #     "supported_models": [
    #         {
    #             "provider": ModelProvider.ANTHROPIC.value,
    #             "models": ["claude-3-opus-20240229", "claude-3-sonnet-20240229"],
    #         },
    #         {
    #             "provider": ModelProvider.OPENAI.value,
    #             "models": ["gpt-4-turbo-preview", "gpt-4", "gpt-3.5-turbo"],
    #         },
    #     ],
    #     "model_settings": {
    #         "max_tokens": {
    #             "type": SettingType.INTEGER.value,
    #             "default": 1000,
    #             "min": 1,
    #             "max": 4096,
    #             "description": "Maximum number of tokens to generate",
    #         },
    #         "temperature": {
    #             "type": SettingType.FLOAT.value,
    #             "default": 0.7,
    #             "min": 0,
    #             "max": 1,
    #             "step": 0.1,
    #             "description": "Controls randomness in the output",
    #         },
    #         "top_p": {
    #             "type": SettingType.FLOAT.value,
    #             "default": 0.9,
    #             "min": 0,
    #             "max": 1,
    #             "step": 0.1,
    #             "description": "Controls diversity via nucleus sampling",
    #         },
    #     },
    #     "agent_settings": {},
    # },
    WebAgentType.BROWSER_USE.value: {
        "name": "Browser Agent",
        "description": "Agent with web browsing capabilities",
        "supported_models": [
            {
                "provider": ModelProvider.OPENAI.value,
                "models": ["gpt-4o", "gpt-4o-mini", "o1"],
            },
            {
                "provider": ModelProvider.ANTHROPIC.value,
                "models": ["claude-3-7-sonnet-latest", "claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
            },
            {
                "provider": ModelProvider.GEMINI.value,
                "models": [
                    "gemini-2.0-flash",
                    "gemini-1.5-pro"
                ],
            },
            {
                "provider": ModelProvider.DEEPSEEK.value,
                "models": [
                    "deepseek-chat",
                    "deepseek-reasoner"
                ],
            },
            {
                "provider": ModelProvider.OLLAMA.value,
                "models": [
                    "llama3.3",
                    "qwen2.5",
                    "llama3",
                    "mistral"
                ],
            },
        ],
        "model_settings": {
            "max_tokens": {
                "type": SettingType.INTEGER.value,
                "default": 1000,
                "min": 1,
                "max": 4096,
                "description": "Maximum number of tokens to generate",
            },
            "temperature": {
                "type": SettingType.FLOAT.value,
                "default": 0.7,
                "min": 0,
                "max": 1,
                "step": 0.05,
                "description": "Controls randomness in the output",
            },
            # "top_p": {
            #     "type": SettingType.FLOAT.value,
            #     "default": 0.9,
            #     "min": 0,
            #     "max": 1,
            #     "step": 0.1,
            #     "description": "Controls diversity via nucleus sampling",
            # },
        },
        "agent_settings": {
            "steps": {
                "type": SettingType.INTEGER.value,
                "default": 100,
                "min": 10,
                "max": 125,
                "description": "Max number of steps to take",
            },
        },
    },
    WebAgentType.CLAUDE_COMPUTER_USE.value: {
        "name": "Claude Computer Use",
        "description": "Advanced agent with Claude-specific capabilities",
        "supported_models": [
            {
                "provider": ModelProvider.ANTHROPIC_COMPUTER_USE.value,
                "models": ["claude-3-5-sonnet-20241022"],
            },
            {
                "provider": ModelProvider.ANTHROPIC.value,
                "models": ["claude-3-7-sonnet-latest"],
            }
        ],
        "model_settings": {
            "max_tokens": {
                "type": SettingType.INTEGER.value,
                "default": 4090,
                "min": 1,
                "max": 4096,
                "description": "Maximum number of tokens to generate",
            },
            "temperature": {
                "type": SettingType.FLOAT.value,
                "default": 0.6,
                "min": 0,
                "max": 1,
                "step": 0.05,
                "description": "Controls randomness in the output",
            },
            # "top_p": {
            #     "type": SettingType.FLOAT.value,
            #     "default": 0.9,
            #     "min": 0,
            #     "max": 1,
            #     "step": 0.1,
            #     "description": "Controls diversity via nucleus sampling",
            # },
        },
        "agent_settings": {
            "system_prompt": {
                "type": SettingType.TEXTAREA.value,
                "default": SYSTEM_PROMPT,
                "maxLength": 4000,
                "description": "System prompt for the agent",
            },
            "num_images_to_keep": {
                "type": SettingType.INTEGER.value,
                "default": 10,
                "min": 1,
                "max": 50,
                "description": "Number of images to keep in memory",
            },
            "wait_time_between_steps": {
                "type": SettingType.INTEGER.value,
                "default": 1,
                "min": 0,
                "max": 10,
                "description": "Wait time between steps in seconds",
            },
        },
    },
    WebAgentType.OPENAI_COMPUTER_USE.value: {
        "name": "OpenAI Computer Use",
        "description": "Agent that uses OpenAI's Computer-Using Agent (CUA) via the /v1/responses API",
        "supported_models": [
            {
                "provider": ModelProvider.OPENAI_COMPUTER_USE.value,
                "models": [
                    "computer-use-preview",
                    "computer-use-preview-2025-02-04"
                ],
            }
        ],
        "model_settings": {
            "max_tokens": {
                "type": SettingType.INTEGER.value,
                "default": 3000,
                "min": 1,
                "max": 4096,
                "description": "Maximum tokens for the responses endpoint",
            },
            "temperature": {
                "type": SettingType.FLOAT.value,
                "default": 0.2,
                "min": 0,
                "max": 1,
                "step": 0.05,
                "description": "Optional temperature param for final assistant messages",
            },
        },
        "agent_settings": {
            "system_prompt": {
                "type": SettingType.TEXTAREA.value,
                "default": "",
                "maxLength": 4000,
                "description": "Custom system prompt for the agent",
            },
            "num_images_to_keep": {
                "type": SettingType.INTEGER.value,
                "default": 10,
                "min": 1,
                "max": 50,
                "description": "Number of images to keep in memory",
            },
            "wait_time_between_steps": {
                "type": SettingType.INTEGER.value,
                "default": 1,
                "min": 0,
                "max": 10,
                "description": "Wait time between steps in seconds",
            },
            "max_steps": {
                "type": SettingType.INTEGER.value,
                "default": 30,
                "min": 10,
                "max": 50,
                "description": "Maximum number of steps the agent can take",
            },
            "viewport_width": {
                "type": SettingType.INTEGER.value,
                "default": 1280,
                "min": 800,
                "max": 1920,
                "description": "Width of the browser viewport in pixels",
            },
            "viewport_height": {
                "type": SettingType.INTEGER.value,
                "default": 800,
                "min": 600,
                "max": 1080,
                "description": "Height of the browser viewport in pixels",
            },
        },
    },
}


def get_web_agent(
    name: WebAgentType,
) -> Callable[
    [ModelConfig, AgentSettings, List[Mapping[str, Any]], str], AsyncIterator[str]
]:
    if name == WebAgentType.BASE:
        return base_agent
    elif name == WebAgentType.CLAUDE_COMPUTER_USE:
        return claude_computer_use
    elif name == WebAgentType.BROWSER_USE:
        return browser_use_agent
    elif name == WebAgentType.OPENAI_COMPUTER_USE:
        return openai_computer_use_agent
    else:
        raise ValueError(f"Invalid agent type: {name}")


__all__ = ["WebAgentType", "get_web_agent", "AGENT_CONFIGS"]
