import datetime
import json
import logging
from typing import Any, Dict, List, Optional

from langchain_core.messages import BaseMessage

from .tools import _make_cua_content_for_role

logger = logging.getLogger("openai_computer_use.conversation_manager")

# Minimal 1x1 transparent pixel as base64 - very small footprint
MINIMAL_BASE64_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


class ConversationManager:
    """
    Manages conversation state/history for the OpenAI computer-use model.
      - Holds a list of conversation 'items'
      - Can initialize from user & system prompts
      - Provides a method to convert items into the format required by the /v1/responses endpoint
      - (Optional) can do image-trimming to reduce context size
    """

    def __init__(self, num_images_to_keep: int = 10):
        self.items: List[Dict[str, Any]] = []
        self.num_images_to_keep = num_images_to_keep
        self.logger = logger

    def initialize_from_history(
        self,
        base_msgs: List[BaseMessage],
        system_prompt: Optional[str] = None,
    ) -> None:
        """
        Convert existing chat history into a set of conversation items
        recognized by the OpenAI 'responses' endpoint. Optionally prepend
        a system prompt.
        """
        # 1) Add system message if provided
        if system_prompt:
            sys_text = f"{system_prompt}\nCurrent date/time: {datetime.datetime.now():%Y-%m-%d %H:%M:%S}"
            self.items.append(
                {
                    "role": "system",
                    "content": _make_cua_content_for_role("system", sys_text),
                }
            )
            self.logger.info("Added system prompt to conversation")

        # 2) Convert each message in history to the correct format
        for msg in base_msgs:
            # In standard usage, msg can be an AIMessage, ToolMessage, or HumanMessage
            if hasattr(msg, "tool_call_id") and msg.tool_call_id:
                # It's a tool result (ToolMessage)
                # In the original code, tool messages become "computer_call_output" items
                self.logger.info(
                    f"Processing tool message with call_id: {msg.tool_call_id}"
                )
                tool_content = msg.content
                if isinstance(tool_content, str):
                    # Keep strings as is
                    content_for_output = tool_content
                else:
                    # Serialize dictionaries or other objects
                    content_for_output = json.dumps(tool_content)

                self.items.append(
                    {
                        "type": "computer_call_output",
                        "call_id": msg.tool_call_id,
                        "output": {
                            "type": "input_image",
                            "image_url": content_for_output,
                        },
                    }
                )
                self.logger.info(
                    f"Added computer_call_output for tool response with call_id: {msg.tool_call_id}"
                )
            elif msg.type == "ai":
                # It's an AI message
                self.logger.info("Processing AI message")
                text = msg.content
                text = text if isinstance(text, str) else json.dumps(text)
                self.items.append(
                    {
                        "role": "assistant",
                        "content": _make_cua_content_for_role("assistant", text),
                    }
                )
                self.logger.info("Added assistant role item")
            elif msg.type == "human":
                # It's a user message
                self.logger.info("Processing human message")
                text = msg.content
                text = text if isinstance(text, str) else json.dumps(text)
                self.items.append(
                    {
                        "role": "user",
                        "content": _make_cua_content_for_role("user", text),
                    }
                )
                self.logger.info("Added user role item")
            else:
                # Fallback for system or other
                self.logger.info(f"Processing {msg.type} message")
                text = msg.content
                text = text if isinstance(text, str) else json.dumps(text)
                self.items.append(
                    {
                        "role": msg.type,
                        "content": _make_cua_content_for_role(msg.type, text),
                    }
                )
                self.logger.info(f"Added {msg.type} role item")

        self.logger.info(f"Processed {len(self.items)} total conversation items")

    def add_item(self, item: Dict[str, Any]) -> None:
        """Add a single item from the new model response (or user input) to the conversation."""
        self.items.append(item)

    def trim_images(self) -> None:
        """
        Optionally trim older images from conversation to save tokens.
        This implementation keeps the most recent images and replaces older ones with a minimal base64 image.
        """
        # Count computer_call_output items with images
        image_items = [
            (i, item)
            for i, item in enumerate(self.items)
            if item.get("type") == "computer_call_output"
            and item.get("output", {}).get("type") == "input_image"
        ]

        if len(image_items) <= self.num_images_to_keep:
            return  # No trimming needed

        # Keep only the most recent images
        images_to_trim = image_items[: -self.num_images_to_keep]

        for idx, item in images_to_trim:
            # Replace image with minimal base64 image placeholder
            call_id = item.get("call_id", "unknown")
            self.items[idx] = {
                "type": "computer_call_output",
                "call_id": call_id,
                "output": {
                    **item.get("output", {}),
                    "image_url": MINIMAL_BASE64_IMAGE,
                },
            }

        self.logger.info(
            f"Trimmed {len(images_to_trim)} older images from conversation"
        )

    def prepare_for_model(self) -> List[Dict[str, Any]]:
        """
        Return a copy of self.items with all transformations needed
        for the /v1/responses request body.
        """
        self.trim_images()
        return self.items.copy()
