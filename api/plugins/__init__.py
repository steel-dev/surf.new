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
from .claude_steel_use import claude_steel_agent
from .browser_use import browser_use_agent
from ..utils.types import AgentSettings
from .claude_steel_use.prompts import SYSTEM_PROMPT

# from .example_plugin import example_agent


class WebAgentType(Enum):
    BASE = "base"
    EXAMPLE = "example"
    CLAUDE_STEEL_USE = "claude_steel_agent"
    BROWSER_USE = "browser_use_agent"


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
                "models": ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
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
    WebAgentType.CLAUDE_STEEL_USE.value: {
        "name": "Claude Steel Agent",
        "description": "Advanced agent with Claude-specific capabilities",
        "supported_models": [
            {
                "provider": ModelProvider.ANTHROPIC_COMPUTER_USE.value,
                "models": ["claude-3-5-sonnet-20241022"],
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
    
}


def get_web_agent(
    name: WebAgentType,
) -> Callable[
    [ModelConfig, AgentSettings, List[Mapping[str, Any]], str], AsyncIterator[str]
]:
    if name == WebAgentType.BASE:
        return base_agent
    elif name == WebAgentType.CLAUDE_STEEL_USE:
        return claude_steel_agent
    elif name == WebAgentType.BROWSER_USE:
        return browser_use_agent
    else:
        raise ValueError(f"Invalid agent type: {name}")


__all__ = ["WebAgentType", "get_web_agent", "AGENT_CONFIGS"]
