import json
from pydantic import BaseModel
from typing import Any, List, Mapping, Optional
from .types import ToolInvocation
from langchain_core.messages import BaseMessage, ChatMessage
from langchain_core.messages import ToolMessage, AIMessage, HumanMessage
from langchain_core.tools.structured import ToolCall


class ClientAttachment(BaseModel):
    url: str
    contentType: str


class ClientMessage(BaseModel):
    role: str
    content: str | List[str | Mapping[str, Any]]
    experimental_attachments: Optional[List[ClientAttachment]] = None
    toolInvocations: Optional[List[ToolInvocation]] = None
    resume_agent: Optional[bool] = None


def convert_to_chat_messages(messages: List[ClientMessage]):
    chat_messages = []

    for message in messages:
        parts = []

        parts.append({"type": "text", "text": message.content})

        if message.experimental_attachments:
            for attachment in message.experimental_attachments:
                if attachment.contentType.startswith("image"):
                    parts.append(
                        {"type": "image_url", "image_url": {"url": attachment.url}}
                    )

                elif attachment.contentType.startswith("text"):
                    parts.append({"type": "text", "text": attachment.url})

        if message.toolInvocations:
            tool_calls = [
                {
                    "id": tool_invocation.toolCallId,
                    "type": "function",
                    "function": {
                        "name": tool_invocation.toolName,
                        "arguments": json.dumps(tool_invocation.args),
                    },
                }
                for tool_invocation in message.toolInvocations
            ]

            chat_messages.append({"role": "assistant", "tool_calls": tool_calls})

            tool_results = [
                {
                    "role": "tool",
                    "content": json.dumps(tool_invocation.result),
                    "tool_call_id": tool_invocation.toolCallId,
                }
                for tool_invocation in message.toolInvocations
            ]

            chat_messages.extend(tool_results)

            continue

        chat_messages.append({"role": message.role, "content": parts})

    return chat_messages


def convert_to_base_messages(messages: List[ClientMessage]) -> List[BaseMessage]:
    chat_messages = convert_to_chat_messages(messages)
    return [BaseMessage(**message) for message in chat_messages]


def chat_dict_to_chat_messages(messages: List[Mapping[str, Any]]) -> List[ChatMessage]:
    return [
        ChatMessage(role=message["role"], content=message["content"])
        for message in messages
    ]


def chat_dict_to_base_messages(messages: List[Mapping[str, Any]]) -> List[BaseMessage]:
    def extract_content(content_array):
        if isinstance(content_array, list):
            # Extract text from content array with type/text structure
            return " ".join(
                item["text"] for item in content_array if item["type"] == "text"
            )
        return content_array

    return [
        (
            ToolMessage(
                tool_call_id=message["tool_call_id"],
                content=json.loads(message["content"]),
            )
            if message["role"] == "tool"
            else (
                AIMessage(
                    content=extract_content(message.get("content", "")),
                    tool_calls=[
                        ToolCall(
                            id=tool["id"],
                            type=tool["type"],
                            name=tool["function"]["name"],
                            args=json.loads(tool["function"]["arguments"]),
                        )
                        for tool in message["tool_calls"]
                    ],
                )
                if message["role"] == "assistant" and "tool_calls" in message
                else (
                    AIMessage(content=message["content"])
                    if message["role"] == "assistant"
                    else HumanMessage(content=message["content"])
                )
            )
        )
        for message in messages
    ]
