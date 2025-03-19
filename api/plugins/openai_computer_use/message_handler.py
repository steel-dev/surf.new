import json
import logging
from typing import Any, Dict, Optional, Tuple

from langchain.schema import AIMessage
from langchain_core.messages import BaseMessage, ToolMessage

from .steel_computer import SteelComputer

logger = logging.getLogger("openai_computer_use.message_handler")


class MessageHandler:
    """
    Processes the model's output items. Responsible for:
      - Converting them into immediate yieldable messages (AIMessage, etc.)
      - Identifying + packaging browser actions (tool calls)
      - Executing those actions using a SteelComputer
      - Returning the final result (screenshot, error, etc.)
    """

    def __init__(self, computer: SteelComputer):
        self.computer = computer
        self.logger = logger

    async def process_item(
        self, item: Dict[str, Any]
    ) -> Tuple[Optional[BaseMessage], Optional[dict]]:
        """
        Converts a single item from the model's response into:
          - a BaseMessage to yield to the client, or None
          - an action dict to pass to `execute_action()`, or None

        For example:
          - "message" -> immediate AIMessage
          - "computer_call" -> yield a tool call, return an action
          - "function_call" -> yield a tool call, return an action
          - "assistant" -> final AIMessage
          - "reasoning" -> yield partial chain-of-thought (hidden or shown)
        """
        item_type = item.get("type")
        self.logger.debug(f"Processing item of type: {item_type}")

        # 1) message chunk
        if item_type == "message":
            # It's a chunk of text from the user or assistant
            # Usually "input_text" or "output_text" parts
            text_segments = item.get("content", [])
            combined_text = ""
            # Gather text from "output_text" or "input_text"
            for seg in text_segments:
                if seg["type"] in ("output_text", "input_text"):
                    combined_text += seg["text"]

            if combined_text.strip():
                # Return an AIMessage chunk
                self.logger.info(f"Yielding message text: {combined_text[:100]}...")
                return AIMessage(content=combined_text), None
            return None, None

        # 2) computer_call -> a direct request to do "click", "scroll", etc.
        if item_type == "computer_call":
            call_id = item["call_id"]
            action = item["action"]
            ack_checks = item.get("pending_safety_checks", [])

            self.logger.info(
                f"[TOOL_CALL] Processing computer action call: {action['type']} (id: {call_id})"
            )

            # We'll yield a minimal AIMessage with a tool call
            # Then return the action to be executed
            tool_call_msg = AIMessage(
                content="",
                tool_calls=[{"name": action["type"], "args": action, "id": call_id}],
            )
            return tool_call_msg, {
                "call_id": call_id,
                "action": action,
                "action_type": "computer_call",
                "ack_checks": ack_checks,
            }

        # 3) function_call -> a request to call "goto", "back", "forward"
        if item_type == "function_call":
            call_id = item["call_id"]
            fn_name = item["name"]
            self.logger.info(
                f"Processing function_call: {fn_name} with call_id: {call_id}"
            )

            try:
                fn_args = json.loads(item["arguments"])
                self.logger.info(
                    f"Successfully parsed arguments for {fn_name}: {json.dumps(fn_args)}"
                )
            except Exception as arg_err:
                self.logger.error(f"Failed to parse arguments for {fn_name}: {arg_err}")
                fn_args = {}

            # yield a minimal AIMessage with the function call
            tool_call_msg = AIMessage(
                content="",
                tool_calls=[{"name": fn_name, "args": fn_args, "id": call_id}],
            )
            return tool_call_msg, {
                "call_id": call_id,
                "action": fn_args,
                "action_type": fn_name,
            }

        # 4) reasoning -> partial chain-of-thought (if any)
        if item_type == "reasoning":
            # We can yield it as a "thoughts" message
            self.logger.info("Processing reasoning item")

            reasoning_text = None

            # Check for tokens first
            if "tokens" in item:
                reasoning_text = item["tokens"]
                self.logger.info(f"Found reasoning tokens: {reasoning_text}")
            # Then check for summary
            elif "summary" in item:
                summary_text = [
                    s.get("text", "")
                    for s in item["summary"]
                    if s.get("type") == "summary_text"
                ]
                if summary_text:
                    reasoning_text = "\n".join(summary_text)
                    self.logger.info(f"Found reasoning summary: {reasoning_text}")

            if reasoning_text and reasoning_text.strip():
                # We'll yield it as an AI message with "Thoughts"
                self.logger.info("Yielding reasoning as AIMessage with thoughts format")
                return AIMessage(content=f"*Thoughts*:\n{reasoning_text}"), None
            return None, None

        # 5) assistant -> final assistant message
        if item_type == "assistant":
            self.logger.info("Received final assistant message")
            content_array = item.get("content", [])
            final_text = ""
            for seg in content_array:
                if seg.get("type") == "output_text":
                    final_text += seg["text"]
            if final_text.strip():
                self.logger.info(f"Yielding final assistant msg: {final_text[:100]}...")
                return AIMessage(content=final_text), None
            return None, None

        # By default, do nothing
        self.logger.warning(f"Unknown item type {item_type} - ignoring.")
        return None, None

    async def execute_action(
        self, action_dict: dict
    ) -> Tuple[Dict[str, Any], ToolMessage]:
        """
        Execute the previously identified action and build the final tool result message.

        Returns a tuple:
            (item_to_add_to_history, tool_result_message_to_yield)
        """
        call_id = action_dict["call_id"]
        action_type = action_dict["action_type"]
        action = action_dict["action"]
        ack_checks = action_dict.get("ack_checks", [])

        self.logger.info(f"Executing action: {action_type} (call_id: {call_id})")

        if action_type in ("goto", "back", "forward"):
            if action_type == "goto":
                final_action = {"type": "goto", "url": action.get("url", "about:blank")}
            elif action_type == "back":
                final_action = {"type": "back"}
            elif action_type == "forward":
                final_action = {"type": "forward"}
            else:
                final_action = {"type": "screenshot"}
        else:
            final_action = action

        result = await self.computer.execute_action(final_action)

        if result.get("type") == "error":
            item_to_add = {
                "type": "computer_call_output",
                "call_id": call_id,
                "output": {
                    "type": "error",
                    "error": result["error"],
                    "tool_name": result.get("tool_name", action_type),
                    "tool_args": result.get("tool_args", final_action),
                },
            }
        else:
            if action_type in ("goto", "back", "forward") or result.get(
                "tool_name"
            ) in ("goto", "back", "forward"):
                item_to_add = {
                    "type": "function_call_output",
                    "call_id": call_id,
                    "output": "success",
                }
            else:
                item_to_add = {
                    "type": "computer_call_output",
                    "call_id": call_id,
                    "acknowledged_safety_checks": ack_checks,
                    "output": {
                        "type": "input_image",
                        "image_url": f"data:image/png;base64,{result.get('source', {}).get('data', '')}",
                        "current_url": result.get("current_url", "about:blank"),
                        "toolName": result.get("tool_name", action_type),
                        "args": result.get("tool_args", final_action),
                    },
                }

        # Build the tool result message to yield
        content_for_tool_msg = []
        if result.get("type") == "error":
            # Return an error structure
            content_for_tool_msg.append(
                {
                    "type": "error",
                    "error": result["error"],
                    "tool_name": result.get("tool_name", action_type),
                    "tool_args": result.get("tool_args", final_action),
                }
            )
        else:
            # Return an image structure
            content_for_tool_msg.append(result)

        tool_result_msg = ToolMessage(
            content=content_for_tool_msg,
            tool_call_id=call_id,
            type="tool",
            name=action_type,
            args=final_action,
            metadata={"message_type": "tool_result"},
        )

        return item_to_add, tool_result_msg

    async def cleanup(self):
        try:
            # Clean up any pending Playwright tasks
            for context in self.computer.browser.contexts:
                await context.close()
            await self.computer.browser.close()
        except Exception as e:
            self.logger.warning(f"Error during browser cleanup: {e}")
