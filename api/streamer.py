import json
from typing import AsyncGenerator

"""
This file contains logic to convert the stream of tokens or partial responses
from LangChain into a Vercel AI Data Stream Protocol format.

We'll define a AsyncGenerator function that yields lines in the correct format.
For a reference on the protocol, see:
https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
"""

import logging

logger = logging.getLogger(__name__)


async def stream_vercel_format(
    stream: AsyncGenerator[str, None],
) -> AsyncGenerator[str, None]:
    """
    stream: yields partial text chunks from the LLM in the Vercel AI Data Stream Protocol format
    """

    draft_tool_calls = {}
    pending_tool_calls = set()

    try:
        async for chunk in stream:

            if isinstance(chunk, dict) and chunk.get("stop"):
                yield 'e:{{"finishReason":"{reason}","usage":{{"promptTokens":{prompt},"completionTokens":{completion}}}}}\n'.format(
                    reason="tool-calls",
                    prompt=0,
                    completion=0,
                )

            # Handle tool call chunks
            if hasattr(chunk, "tool_call_chunks") and chunk.tool_call_chunks:
                for tool_chunk in chunk.tool_call_chunks:
                    index = tool_chunk.get("index")
                    # extra debugging
                    # print("DEBUG: Tool chunk details:", tool_chunk)
                    if index is not None:
                        # Initialize new tool call if needed
                        if index not in draft_tool_calls and tool_chunk.get("id"):
                            draft_tool_calls[index] = {
                                "id": tool_chunk["id"],
                                "name": tool_chunk["name"],
                                "arguments": "",
                            }
                            pending_tool_calls.add(tool_chunk["id"])

                        # Append arguments if they exist
                        if tool_chunk.get("args") and index in draft_tool_calls:
                            draft_tool_calls[index]["arguments"] += tool_chunk["args"]

                            # If we have a complete tool call (has id, name and arguments), emit it
                            tool_call = draft_tool_calls[index]
                            if (
                                tool_call["id"]
                                and tool_call["name"]
                                and tool_call["arguments"]
                            ):
                                try:
                                    # Validate it's valid JSON before emitting
                                    json.loads(tool_call["arguments"])

                                    yield '9:{{"toolCallId":"{id}","toolName":"{name}","args":{args}}}\n'.format(
                                        id=tool_call["id"],
                                        name=tool_call["name"],
                                        args=tool_call["arguments"],
                                    )
                                except json.JSONDecodeError:
                                    # Arguments not complete yet, continue gathering
                                    print(
                                        "DEBUG: Arguments not complete yet, continuing"
                                    )

            # Handle full tool calls
            elif hasattr(chunk, "tool_calls") and chunk.tool_calls:
                if hasattr(chunk, "content"):
                    if isinstance(chunk.content, list):
                        for item in chunk.content:
                            if item.get("type") == "text":
                                yield f"0:{json.dumps(item['text'])}\n"
                    else:
                        yield f"0:{json.dumps(chunk.content)}\n"
                for tool_call in chunk.tool_calls:
                    logger.info(f"Emitting tool call: {tool_call.get('id')}")
                    pending_tool_calls.add(tool_call.get("id"))
                    yield f'9:{{"toolCallId":"{tool_call.get("id")}","toolName":"{tool_call.get("name")}","args":{json.dumps(tool_call.get("args"))}}}\n'

            # Handle tool call results (that are not tool_call_chunks)
            elif hasattr(chunk, "tool_call_id") and chunk.tool_call_id:
                logger.info(f"Found tool_call_id: {chunk.tool_call_id}")
                logger.info(f"Emitting tool result for: {chunk.tool_call_id}")
                logger.info(f'a:{{"toolCallId":"{chunk.tool_call_id}","result":{json.dumps(chunk.content)}}}\n')
                # Only try to remove if it exists in the set
                if chunk.tool_call_id in pending_tool_calls:
                    pending_tool_calls.remove(chunk.tool_call_id)
                yield f'a:{{"toolCallId":"{chunk.tool_call_id}","result":{json.dumps(chunk.content)}}}\n'

                # Check if this is the last tool result by looking at stop_reason
                if len(pending_tool_calls) == 0:
                    draft_tool_calls = {}
                    logger.info(f"Emitting finish reason after final tool result")
                    yield 'e:{{"finishReason":"{reason}","usage":{{"promptTokens":{prompt},"completionTokens":{completion}}}}}\n'.format(
                        reason="tool-calls",
                        prompt=0,
                        completion=0,
                    )

            # Handle regular text content
            elif hasattr(chunk, "content") and chunk.content:
                # print("DEBUG: Found text content:", chunk.content)
                if isinstance(chunk.content, list):
                    for item in chunk.content:
                        if item.get("type") == "text":
                            yield f"0:{json.dumps(item['text'])}\n"
                else:
                    yield f"0:{json.dumps(chunk.content)}\n"
    except Exception as e:
        yield f"3:{json.dumps(e.__str__())}\n"
    finally:
        finish_reason = "stop"
        # Yield the final finish part
        usage_obj = {
            "promptTokens": 0,
            "completionTokens": 0,
        }
        yield f"e:{json.dumps({'finishReason': finish_reason, 'usage': usage_obj, 'isContinued': False})}\n"
