"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CheckIcon, Crosshair2Icon, ReaderIcon } from "@radix-ui/react-icons";
import { useChat } from "ai/react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { AuthModal } from "@/components/ui/AuthModal";
import { Browser } from "@/components/ui/Browser";
import { Button } from "@/components/ui/button";
import { ChatInput } from "@/components/ui/ChatInput";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ToolInvocations } from "@/components/ui/tool";

import { useToast } from "@/hooks/use-toast";

import { useChatContext } from "@/app/contexts/ChatContext";
import { useSettings } from "@/app/contexts/SettingsContext";
import { useSteelContext } from "@/app/contexts/SteelContext";

// UPDATED CodeBlock component for rendering code blocks with a copy button and language display.
const CodeBlock = React.memo(({ code, language }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  }, [code]);

  if (language) {
    return (
      <div className="my-4  overflow-hidden rounded">
        {/* Header bar displaying the language (if provided) and the copy button */}
        <div className="flex items-center justify-between bg-[--gray-1] px-3 py-1 text-xs text-[--gray-12]">
          <span>{language.toUpperCase()}</span>
          <button
            onClick={handleCopy}
            className="rounded border border-[--gray-3] bg-[--gray-1] px-2 py-1 text-xs transition-colors hover:bg-[--gray-2]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <SyntaxHighlighter
          language={language}
          style={atomDark}
          customStyle={{ padding: "1rem", margin: 0, borderRadius: "0.5rem" }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }

  // Fallback if no language is provided: show the copy button as an overlay.
  return (
    <div className="group relative my-4">
      <SyntaxHighlighter
        language="text"
        style={atomDark}
        customStyle={{ padding: "1rem", borderRadius: "0.5rem" }}
      >
        {code}
      </SyntaxHighlighter>
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 hidden rounded bg-gray-700 px-2 py-1 text-xs text-white group-hover:block"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
});

CodeBlock.displayName = "CodeBlock";

// UPDATED MarkdownText component to support code blocks along with inline markdown
const MarkdownText = React.memo(({ content }: { content: string }) => {
  // Helper function to process inline markdown (links, bold, italics)
  const parseInlineMarkdown = useCallback((text: string, keyOffset: number) => {
    const segments = text.split(/(\[.*?\]\(.*?\))|(\*.*?\*)|(_.*?_)/g).filter(Boolean);
    return segments.map((segment, index) => {
      const key = `${keyOffset}-${index}`;
      // Handle markdown links [text](url)
      if (/^\[.*?\]\(.*?\)$/.test(segment)) {
        const linkMatch = segment.match(/^\[(.*?)\]\((.*?)\)$/);
        if (linkMatch) {
          return (
            <a
              key={key}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[--blue-11] hover:underline"
            >
              {linkMatch[1]}
            </a>
          );
        }
      }
      // Handle bold text *text*
      if (/^\*.*\*$/.test(segment)) {
        const boldMatch = segment.match(/^\*(.*?)\*$/);
        if (boldMatch) {
          return <strong key={key}>{boldMatch[1]}</strong>;
        }
      }
      // Handle italics _text_
      if (/^_.*_$/.test(segment)) {
        const italicMatch = segment.match(/^_(.*?)_$/);
        if (italicMatch) {
          return <em key={key}>{italicMatch[1]}</em>;
        }
      }
      // Return plain text if no markdown matched
      return <span key={key}>{segment}</span>;
    });
  }, []);

  // Main parser that first detects code blocks and falls back to inline markdown
  const parseContent = useCallback(
    (text: string) => {
      const elements = [];
      let lastIndex = 0;
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match: RegExpExecArray | null;
      let key = 0;

      while ((match = codeBlockRegex.exec(text)) !== null) {
        // Process any text before the code block as inline markdown
        if (match.index > lastIndex) {
          const inlineText = text.substring(lastIndex, match.index);
          elements.push(...parseInlineMarkdown(inlineText, key));
          key++;
        }
        // Extract language (if provided) and code content, then render the CodeBlock
        const language = match[1] || "";
        const codeContent = match[2];
        elements.push(<CodeBlock key={`code-${key}`} language={language} code={codeContent} />);
        key++;
        lastIndex = codeBlockRegex.lastIndex;
      }

      // Process any remaining text after the last code block
      if (lastIndex < text.length) {
        const inlineText = text.substring(lastIndex);
        elements.push(...parseInlineMarkdown(inlineText, key));
      }
      return elements;
    },
    [parseInlineMarkdown]
  );

  const isMemory = content.startsWith("*Memory*:");
  const isGoal = content.startsWith("*Next Goal*:") || content.startsWith("*Previous Goal*:");

  if (isMemory || isGoal) {
    // Extract the title and content
    const titleMatch = content.match(/^\*(Memory|Next Goal|Previous Goal)\*:/);
    const title = titleMatch ? titleMatch[1] : ""; // Remove the asterisks and colon
    const strippedContent = content.replace(/^\*(Memory|Next Goal|Previous Goal)\*:/, "").trim();

    return (
      <div className="relative">
        {isMemory ? (
          <ReaderIcon className="absolute right-4 top-4 size-4 text-[--gray-11]" />
        ) : (
          <Crosshair2Icon className="absolute right-4 top-4 size-4 text-[--gray-11]" />
        )}
        <div className="rounded-2xl border border-[--gray-3] bg-[--gray-2] p-4">
          <div className="pr-8">
            <div className="mb-1 font-medium text-[--gray-12] text-sm">{title}</div>
            {strippedContent ? (
              <div className="text-sm text-[--gray-10]">{parseContent(strippedContent)}</div>
            ) : (
              <span className="text-sm text-[--gray-10]">Empty</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{parseContent(content)}</>;
});

MarkdownText.displayName = "MarkdownText";

const UserMessage = React.memo(({ content }: { content: string }) => {
  const hasLineBreaks = content.includes("\n");
  const longestLine = Math.max(...content.split("\n").map(line => line.length));
  const isLongMessage = longestLine > 60;

  return (
    <div className="flex w-full justify-end">
      <div
        className={`
          inline-flex w-fit max-w-[85%] p-3 font-geist
          ${isLongMessage || hasLineBreaks ? "rounded-3xl" : "rounded-full px-4"}
          shrink-0 bg-[--blue-9]
        `}
      >
        <div
          className={`
            w-full overflow-hidden whitespace-pre-wrap 
            break-words font-geist text-base
            font-normal leading-normal text-[--gray-12]
          `}
        >
          <MarkdownText content={content} />
        </div>
      </div>
    </div>
  );
});

UserMessage.displayName = "UserMessage";

/**
 * ChatScrollAnchor:
 * - Used with Intersection Observer to track visibility of the bottom of the chat.
 * - If isAtBottom and trackVisibility are both true, it automatically scrolls
 *   the chat area to bottom whenever the anchor is out of view (new messages).
 */
const ChatScrollAnchor = React.memo(
  ({
    trackVisibility,
    isAtBottom,
    scrollAreaRef,
  }: {
    trackVisibility: boolean;
    isAtBottom: boolean;
    scrollAreaRef: React.RefObject<HTMLDivElement>;
  }) => {
    const { ref, inView } = useInView({
      trackVisibility,
      delay: 100,
    });

    useEffect(() => {
      if (isAtBottom && trackVisibility && !inView && scrollAreaRef.current?.children[0]) {
        const messagesContainer = scrollAreaRef.current.children[0];
        messagesContainer.scrollTop =
          messagesContainer.scrollHeight - messagesContainer.clientHeight;
      }
    }, [inView, isAtBottom, trackVisibility, scrollAreaRef]);

    return <div ref={ref} className="h-px w-full" />;
  }
);

ChatScrollAnchor.displayName = "ChatScrollAnchor";

// Create a completely isolated input container near the top of the file, after other component definitions
const ChatInputContainer = React.memo(
  ({
    initialValue = "",
    onSend,
    disabled,
    isLoading,
    onStop,
  }: {
    initialValue?: string;
    onSend: (messageText: string) => void;
    disabled: boolean;
    isLoading: boolean;
    onStop: () => void;
  }) => {
    console.log("[RENDER] ChatInputContainer rendering");
    const [inputValue, setInputValue] = useState(initialValue);

    // Keep local input state synchronized with initial value
    useEffect(() => {
      if (initialValue !== inputValue) {
        setInputValue(initialValue);
      }
    }, [initialValue]);

    const handleChange = useCallback((value: string) => {
      setInputValue(value);
    }, []);

    const handleSubmit = useCallback(
      (e: React.FormEvent, messageText: string, attachments: File[]) => {
        e.preventDefault();
        onSend(messageText);
        setInputValue("");
      },
      [onSend]
    );

    return (
      <ChatInput
        value={inputValue}
        onChange={handleChange}
        onSubmit={handleSubmit}
        disabled={disabled}
        isLoading={isLoading}
        onStop={onStop}
      />
    );
  }
);

ChatInputContainer.displayName = "ChatInputContainer";

// Memoize the Browser component to prevent unnecessary re-renders
const MemoizedBrowser = React.memo(Browser);
MemoizedBrowser.displayName = "MemoizedBrowser";

// Define proper types for messages and tool invocations
interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: "call" | "result" | "partial-call";
  result?: unknown;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolInvocations?: ToolInvocation[];
  experimental_attachments?: Array<{ name: string; [key: string]: unknown }>;
}

// Fix the linter errors in MemoizedMessageList by adding types
const MemoizedMessageList = React.memo(
  ({
    messages,
    isCreatingSession,
    hasShownConnection,
    currentSession,
    onImageClick,
    isPaused,
    handleResume,
  }: {
    messages: ChatMessage[];
    isCreatingSession: boolean;
    hasShownConnection: boolean;
    currentSession: { id: string; debugUrl?: string };
    onImageClick: (src: string) => void;
    isPaused: boolean;
    handleResume: () => void;
  }) => {
    console.log("[RENDER] MemoizedMessageList rendering");

    return (
      <>
        {messages.map((message, index) => {
          // Group resume messages together - only render the most recent one
          // with the same content if they appear consecutively
          if (
            message.content === "▶️ AI control has been resumed." &&
            index > 0 &&
            messages[index - 1].content === "▶️ AI control has been resumed."
          ) {
            return null;
          }

          return (
            <div key={message.id || index} className="flex w-full max-w-full flex-col gap-2">
              {/* Force message content to respect container width */}
              <div className="w-full max-w-full">
                {message.role === "user" ? (
                  <>
                    <UserMessage content={message.content} />
                    {index === 0 && isCreatingSession && (
                      <div className="mx-auto mt-2 w-[85%] animate-pulse rounded-md border border-[--blue-3] bg-[--blue-2] px-4 py-2 font-geist text-sm text-[--blue-11]">
                        Connecting to Steel Browser Session...
                      </div>
                    )}
                    {index === 0 &&
                      hasShownConnection &&
                      !isCreatingSession &&
                      currentSession?.id && (
                        <div className="mx-auto mt-2 flex w-[85%] items-center gap-2 rounded-md border border-[--green-3] bg-[--green-2] px-4 py-2 font-geist text-sm text-[--green-11]">
                          <CheckIcon className="size-4" />
                          Steel Browser Session connected
                        </div>
                      )}
                  </>
                ) : (
                  <div className="flex w-full max-w-full flex-col gap-4 break-words text-base text-[--gray-12]">
                    {(() => {
                      const isSpecialMessage =
                        (message.content &&
                          (message.content.includes("*Memory*:") ||
                            message.content.includes("*Next Goal*:") ||
                            message.content.includes("*Previous Goal*:"))) ||
                        (message.toolInvocations && message.toolInvocations.length > 0);
                      const hasToolInvocations =
                        message.toolInvocations && message.toolInvocations.length > 0;
                      const isSpecial = isSpecialMessage || hasToolInvocations;

                      // Check for pause message in content or tool calls
                      const pauseToolCall = message.toolInvocations?.find(
                        (tool: ToolInvocation) => tool.toolName === "pause_execution"
                      );
                      const isPauseToolCall = hasToolInvocations && !!pauseToolCall;
                      const isPauseContentMessage =
                        message.content?.includes("⏸️ Pausing execution") ||
                        message.content?.includes("⏸️ You have taken control");
                      const isPauseMessage = isPauseToolCall || isPauseContentMessage;

                      // Get the pause reason from either source
                      let pauseReason = "";
                      if (isPauseToolCall && pauseToolCall) {
                        // Clean up the reason - sometimes it includes the "⏸️" prefix which causes duplication
                        const rawReason =
                          typeof pauseToolCall.args.reason === "string"
                            ? pauseToolCall.args.reason
                            : "Unknown reason";
                        pauseReason = rawReason.replace(/^⏸️\s*/, "");
                      } else if (isPauseContentMessage && message.content) {
                        if (message.content.includes("⏸️ Pausing execution:")) {
                          const parts = message.content.split("⏸️ Pausing execution: ");
                          pauseReason = parts[1]?.trim() || "Unknown reason";
                        } else if (message.content.includes("⏸️ You have taken control")) {
                          pauseReason = "You have taken control of the browser";
                        }
                      }

                      // This is a critical check - if it's a pause message, we need to render it
                      if (isPauseMessage) {
                        // Check if this is the most recent pause message
                        const isLatestPauseMessage = !messages.some((m, i) => {
                          if (i <= index) return false; // Only check messages after this one

                          // Check if there's a newer pause message
                          return (
                            m.content?.includes("⏸️ Pausing execution") ||
                            m.toolInvocations?.some(
                              (tool: ToolInvocation) => tool.toolName === "pause_execution"
                            )
                          );
                        });

                        // Check if the user has sent a message after this pause
                        const userSentMessageAfterPause = messages.some((m, i) => {
                          return i > index && m.role === "user";
                        });

                        // Only show buttons if this is the latest pause and no user message after it
                        const showButtons = isLatestPauseMessage && !userSentMessageAfterPause;

                        // Extract reason from the current message
                        let displayReason = "";

                        if (pauseToolCall) {
                          displayReason =
                            typeof pauseToolCall.args.reason === "string"
                              ? pauseToolCall.args.reason
                              : "Awaiting your confirmation";
                        } else if (message.content) {
                          if (message.content.includes("⏸️ Pausing execution:")) {
                            const parts = message.content.split("⏸️ Pausing execution:");
                            displayReason = parts[1]?.trim() || "Awaiting your confirmation";
                          } else if (message.content.includes("⏸️ You have taken control")) {
                            displayReason = "You have taken control of the browser";
                          } else {
                            displayReason = message.content.replace("⏸️ ", "").trim();
                          }
                        }

                        if (!displayReason) {
                          displayReason = "Awaiting your confirmation";
                        }

                        console.info("💬 Rendering pause message:", {
                          index,
                          isLatestPauseMessage,
                          userSentMessageAfterPause,
                          showButtons,
                          pauseReason:
                            pauseReason ||
                            message.content ||
                            (pauseToolCall?.args.reason as string),
                        });

                        return (
                          <div
                            className={`flex w-full max-w-full flex-col gap-4 ${!showButtons ? "opacity-80" : ""}`}
                          >
                            <div className="flex flex-col gap-4">
                              <div className="font-normal text-[--gray-12]">
                                <MarkdownText content={displayReason} />
                                {!showButtons && (
                                  <div className="mt-2 text-sm text-[--gray-10] italic">
                                    (Confirmation no longer needed)
                                  </div>
                                )}
                              </div>
                              {showButtons && (
                                <div className="flex gap-3">
                                  <Button
                                    onClick={() => {
                                      console.info("🖱️ Take Control button clicked");
                                      handleResume();
                                    }}
                                    className="rounded-full bg-white px-6 py-3 text-base font-medium text-black transition-colors hover:bg-[--gray-11] hover:text-[--gray-1]"
                                  >
                                    Take Control
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      console.info("🖱️ Keep Going button clicked");
                                      handleResume();
                                    }}
                                    variant="outline"
                                    className="rounded-full bg-[--gray-3] px-6 py-3 text-base font-medium text-[--gray-11] transition-colors hover:bg-[--gray-4]"
                                  >
                                    Keep Going
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Find consecutive special messages
                      let specialMessagesGroup = [];
                      if (isSpecial) {
                        let i = index;
                        while (i < messages.length) {
                          const nextMessage = messages[i];
                          const isNextSpecial =
                            (nextMessage.content &&
                              (nextMessage.content.includes("*Memory*:") ||
                                nextMessage.content.includes("*Next Goal*:") ||
                                nextMessage.content.includes("*Previous Goal*:"))) ||
                            (nextMessage.toolInvocations && nextMessage.toolInvocations.length > 0);

                          if (!isNextSpecial) break;
                          specialMessagesGroup.push(nextMessage);
                          i++;
                        }
                      }

                      // Skip if this message is part of a group but not the first one
                      if (isSpecial && index > 0) {
                        const prevMessage = messages[index - 1];
                        const isPrevSpecial =
                          (prevMessage.content &&
                            (prevMessage.content.includes("*Memory*:") ||
                              prevMessage.content.includes("*Next Goal*:") ||
                              prevMessage.content.includes("*Previous Goal*:"))) ||
                          (prevMessage.toolInvocations && prevMessage.toolInvocations.length > 0);
                        if (isPrevSpecial) return null;
                      }

                      return isSpecial ? (
                        <div className="flex w-full max-w-full flex-col gap-2 rounded-[1.25rem] border border-[--gray-3] bg-[--gray-1] p-2">
                          <div className="flex flex-col gap-2">
                            {specialMessagesGroup.map((groupMessage, groupIndex) => (
                              <React.Fragment key={groupMessage.id}>
                                {groupMessage.content && (
                                  <div className="w-full">
                                    <MarkdownText content={groupMessage.content} />
                                  </div>
                                )}
                                {groupMessage.toolInvocations &&
                                  groupMessage.toolInvocations.length > 0 && (
                                    <div className="flex w-full flex-col gap-2">
                                      {groupMessage.toolInvocations
                                        .filter(tool => {
                                          // Filter out pause_execution tools
                                          if (tool.toolName === "pause_execution") {
                                            return false;
                                          }

                                          // Make sure print_call tools have a message
                                          if (
                                            tool.toolName === "print_call" &&
                                            (!tool.args || !tool.args.message)
                                          ) {
                                            return false;
                                          }

                                          return true;
                                        })
                                        .map((tool: any, toolIndex: number) => (
                                          <div
                                            key={toolIndex}
                                            className="flex w-full items-center justify-between rounded-2xl border border-[--gray-3] bg-[--gray-2] p-3"
                                          >
                                            <ToolInvocations
                                              toolInvocations={[tool]}
                                              onImageClick={onImageClick}
                                            />
                                          </div>
                                        ))}
                                    </div>
                                  )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ) : message.content ? (
                        <div className="w-full max-w-full whitespace-pre-wrap break-words">
                          <MarkdownText content={message.content} />
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
              {message.experimental_attachments?.map((attachment: any, idx: number) => (
                <div
                  key={idx}
                  className="
                    mt-1
                    inline-flex
                    h-8 items-center
                    gap-2
                    rounded-full
                    border
                    border-[--gray-3]
                    bg-[--gray-2]
                    px-2
                  "
                >
                  <span className="font-geist text-sm font-normal leading-[18px] text-[--gray-11]">
                    {attachment.name}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </>
    );
  }
);

MemoizedMessageList.displayName = "MemoizedMessageList";

// Create a custom hook to isolate chat state
function useChatState({
  currentSession,
  initialMessage,
  chatBodyConfig,
  toast,
}: {
  currentSession: any;
  initialMessage: string | null;
  chatBodyConfig: any;
  toast: any;
}) {
  // Get chat functionality from useChat
  return useChat({
    api: "/api/chat",
    id: currentSession?.id || undefined,
    maxSteps: 10,
    initialMessages: initialMessage
      ? [{ id: "1", role: "user", content: initialMessage }]
      : undefined,
    body: chatBodyConfig,
    onFinish: message => {
      console.log("[CHAT] Chat finished message:", message.id);
    },
    onError: error => {
      console.error("[CHAT] Chat error:", error);
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred",
        className: "text-[var(--gray-12)] border border-[var(--red-11)] bg-[var(--red-2)] text-sm",
      });
    },
    onToolCall: toolCallEvent => {
      console.log("[CHAT] Tool call received:", JSON.stringify(toolCallEvent, null, 2));
      // We'll implement more reliable message updates after understanding the structure
    },
  });
}

// Create a memoized component that holds the entire chat UI
interface ChatPageContentProps {
  messages: any[];
  isLoading: boolean;
  input: string;
  handleInputChange: any;
  handleSubmit: any;
  handleStop: () => void;
  reload: () => void;
  isCreatingSession: boolean;
  hasShownConnection: boolean;
  currentSession: any;
  isExpired: boolean;
  handleNewChat: () => void;
  handleImageClick: (src: string) => void;
  setMessages: any;
  isAtBottom: boolean;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  handleScroll: () => void;
  removeIncompleteToolCalls: () => void;
  stop: () => void;
  handleSend: (e: React.FormEvent, messageText: string, attachments: File[]) => void;
  isPaused: boolean;
  resumeLoading: boolean;
  handleResume: () => void;
}

const ChatPageContent = React.memo(
  ({
    messages,
    isLoading,
    input,
    handleInputChange,
    handleSubmit,
    handleStop,
    reload,
    isCreatingSession,
    hasShownConnection,
    currentSession,
    isExpired,
    handleNewChat,
    handleImageClick,
    setMessages,
    isAtBottom,
    scrollAreaRef,
    handleScroll,
    removeIncompleteToolCalls,
    stop,
    handleSend,
    isPaused,
    resumeLoading,
    handleResume,
  }: ChatPageContentProps) => {
    console.log("[RENDER] ChatPageContent rendering");

    // Determine if we should show the loading indicator
    const showLoadingIndicator = isLoading || resumeLoading;

    return (
      <>
        <div className="flex h-[calc(100vh-3.5rem)] flex-col-reverse md:flex-row">
          {/* Left (chat) - Fluid responsive width */}
          <div
            className="
            flex h-[40vh] 
            w-full flex-col border-t border-[--gray-3]
            md:h-full md:w-[clamp(280px,30vw,460px)]
            md:border-r md:border-t-0
          "
          >
            <div className="flex-1 overflow-hidden" ref={scrollAreaRef} onScroll={handleScroll}>
              <div
                className="scrollbar-gutter-stable scrollbar-thin flex size-full flex-col gap-4 overflow-y-auto overflow-x-hidden
                  p-4
                  [&::-webkit-scrollbar-thumb]:rounded-full
                  [&::-webkit-scrollbar-thumb]:border-4
                  [&::-webkit-scrollbar-thumb]:bg-[--gray-3]
                  [&::-webkit-scrollbar-thumb]:transition-colors
                  [&::-webkit-scrollbar-thumb]:hover:bg-[--gray-3]
                  [&::-webkit-scrollbar-track]:rounded-full
                  [&::-webkit-scrollbar-track]:bg-[--gray-1]
                  [&::-webkit-scrollbar]:w-1.5"
              >
                {/* Messages */}
                <MemoizedMessageList
                  messages={messages}
                  isCreatingSession={isCreatingSession}
                  hasShownConnection={hasShownConnection}
                  currentSession={currentSession}
                  onImageClick={handleImageClick}
                  isPaused={isPaused}
                  handleResume={handleResume}
                />
                {showLoadingIndicator && (
                  <div className="flex items-center gap-2">
                    <div className="size-4 animate-spin rounded-full border-2 border-[--gray-12] border-t-transparent" />
                    {resumeLoading && (
                      <span className="text-sm text-[--gray-10]">
                        Waiting for agent to continue...
                      </span>
                    )}
                  </div>
                )}

                {/* Simplified scroll anchor */}
                <ChatScrollAnchor
                  scrollAreaRef={scrollAreaRef}
                  isAtBottom={isAtBottom}
                  trackVisibility={showLoadingIndicator}
                />
              </div>
            </div>

            {/* Chat input or Expired State */}
            <div className="border-t border-[--gray-3]" />
            <div className="min-h-44 flex-none p-4 drop-shadow-md">
              {isExpired ? (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm font-medium text-[--gray-11]">
                    Your browser session has expired
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full border-[--gray-3] bg-[--gray-1] text-[--gray-11]"
                    onClick={handleNewChat}
                  >
                    <Plus className="size-4" />
                    <span className="px-1 font-geist">New Chat</span>
                  </Button>
                </div>
              ) : (
                <ChatInputContainer
                  initialValue={input}
                  onSend={messageText => {
                    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                    handleSend(fakeEvent, messageText, []);
                  }}
                  disabled={showLoadingIndicator}
                  isLoading={showLoadingIndicator}
                  onStop={handleStop}
                />
              )}
            </div>
          </div>

          {/* Right (browser) - Keep more prominent */}
          <div
            className="
              h-[60vh] 
              flex-1 border-b
            h-[60vh] 
            flex-1 border-b
            border-[--gray-3] p-4 md:h-full 
            md:border-b-0
          "
          >
            <TimerDisplay isPaused={isPaused} />
          </div>
        </div>
      </>
    );
  }
);

ChatPageContent.displayName = "ChatPageContent";

// Update the TimerDisplay component to be completely isolated
const TimerDisplay = React.memo(({ isPaused }: { isPaused: boolean }) => {
  console.log("[RENDER] TimerDisplay rendering");

  // No state, no store access here - completely isolated
  return <MemoizedBrowser isPaused={isPaused} />;
});

TimerDisplay.displayName = "TimerDisplay";

export default function ChatPage() {
  console.log("[RENDER] ChatPage is rendering");
  const { currentSettings, updateSettings } = useSettings();
  const { currentSession, createSession, isCreatingSession, isExpired } = useSteelContext();
  console.log("[DEBUG] ChatPage rendering");
  const { initialMessage, setInitialMessage } = useChatContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasShownConnection, setHasShownConnection] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Add API key modal state and handlers
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const pendingMessageRef = useRef<string>("");

  // Track whether user is at the bottom
  const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // After defining checkApiKey
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string>("");
  const [resumeLoading, setResumeLoading] = useState(false);

  // Add a ref to track if a resume request is in progress
  const resumeRequestInProgress = useRef(false);

  // Add a ref for tracking the last resume timestamp
  const lastResumeTimestamp = useRef(0);

  // Utility functions that need to be defined before they're used
  const checkApiKey = useCallback(() => {
    return true;
  }, []);

  // Helper function to check if a value is a setting config object
  const isSettingConfig = useCallback((value: any): boolean => {
    return value && typeof value === "object" && "type" in value && "default" in value;
  }, []);

  // Memoize chatBody config
  const chatBodyConfig = useMemo(
    () => ({
      session_id: currentSession?.id,
      agent_type: currentSettings?.selectedAgent,
      provider: currentSettings?.selectedProvider,
      api_key: currentSettings?.providerApiKeys?.[currentSettings?.selectedProvider || ""] || "",
      model_settings: {
        model_choice: currentSettings?.selectedModel,
        max_tokens: Number(currentSettings?.modelSettings.max_tokens),
        temperature: Number(currentSettings?.modelSettings.temperature),
        top_p: currentSettings?.modelSettings.top_p
          ? Number(currentSettings?.modelSettings.top_p)
          : undefined,
        top_k: currentSettings?.modelSettings.top_k
          ? Number(currentSettings?.modelSettings.top_k)
          : undefined,
        frequency_penalty: currentSettings?.modelSettings.frequency_penalty
          ? Number(currentSettings?.modelSettings.frequency_penalty)
          : undefined,
        presence_penalty: currentSettings?.modelSettings.presence_penalty
          ? Number(currentSettings?.modelSettings.presence_penalty)
          : undefined,
      },
      agent_settings: Object.fromEntries(
        Object.entries(currentSettings?.agentSettings ?? {})
          .filter(([_, value]) => value !== undefined && !isSettingConfig(value))
          .map(([key, value]) => [key, typeof value === "string" ? value : Number(value)])
      ),
    }),
    [currentSession?.id, currentSettings, isSettingConfig]
  );

  // Use the custom hook instead of directly using useChat
  const { messages, handleSubmit, isLoading, input, handleInputChange, setMessages, reload, stop } =
    useChatState({
      currentSession,
      initialMessage,
      chatBodyConfig,
      toast,
    });

  // Near the beginning of the ChatPage function
  const handleApiKeySubmit = useCallback(
    (key: string) => {
      const provider = currentSettings?.selectedProvider;
      if (!provider) return;

      const currentKeys = currentSettings?.providerApiKeys || {};
      updateSettings({
        ...currentSettings!,
        providerApiKeys: {
          ...currentKeys,
          [provider]: key,
        },
      });
      setShowApiKeyModal(false);

      if (pendingMessageRef.current) {
        setInitialMessage(pendingMessageRef.current);
        pendingMessageRef.current = "";
      }
    },
    [currentSettings, updateSettings, setInitialMessage]
  );

  const handleScroll = useCallback(() => {
    if (!scrollAreaRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current.children[0];
    const atBottom = scrollHeight - clientHeight <= scrollTop + 1;

    if (atBottom !== isAtBottom) {
      setIsAtBottom(atBottom);
    }
  }, [isAtBottom]);

  const handleImageClick = useCallback((imageSrc: string) => {
    setSelectedImage(imageSrc);
  }, []);

  // Enhanced handleSend with more logging
  async function handleSend(e: React.FormEvent, messageText: string, attachments: File[]) {
    console.info("📤 Handling message send:", {
      messageText,
      hasAttachments: attachments.length > 0,
      attachmentsCount: attachments.length,
      isFirstMessage: messages.length === 0,
      isSubmitting,
      hasApiKey: checkApiKey(),
      isPaused,
    });

    e.preventDefault();

    if (!checkApiKey()) {
      pendingMessageRef.current = messageText;
      setShowApiKeyModal(true);
      return;
    }

    setIsSubmitting(true);

    // If we're paused, we need to resume first
    if (isPaused) {
      console.info("⏸️ Message sent while paused, resuming first");
      await handleResume();
      // Small delay to ensure the resume has taken effect
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // If we already have a session, use it regardless of message count
    if (currentSession?.id) {
      console.info("📤 Submitting message to existing chat session:", {
        messageText,
        sessionId: currentSession?.id,
        existingMessages: messages.length,
        wasPaused: isPaused,
      });
      handleSubmit(e);
      return;
    }

    // No existing session - this is a new conversation
    if (messages.length === 0) {
      console.info("📝 Setting initial message with context:", {
        messageText,
        hasAttachments: attachments.length > 0,
        attachmentsCount: attachments.length,
      });
      setInitialMessage(messageText);
      handleInputChange({ target: { value: "" } } as any);

      // Create a new session if needed
      if (!currentSession?.id) {
        console.info("🔄 Creating new session for initial message");
        await createSession();
        console.info("✅ New session created");
      }
    } else {
      // This case shouldn't normally happen (messages exist but no session)
      // but we'll handle it just in case
      console.info("📤 Submitting message to chat with no active session:", {
        messageText,
        existingMessages: messages.length,
      });
      handleSubmit(e);
    }
  }

  // Modify the useEffect that handles session creation
  useEffect(() => {
    const isNewSession = currentSession?.id && !hasShownConnection;
    if (isNewSession) {
      reload();
      setIsSubmitting(false);
      setInitialMessage(null);
      setHasShownConnection(true);
    }
  }, [currentSession?.id, hasShownConnection, reload, setInitialMessage]);

  // Enhanced removeIncompleteToolCalls with more detailed logging
  const removeIncompleteToolCalls = useCallback(() => {
    setMessages(prev => {
      const updatedMessages = prev
        .map(msg => {
          if (msg.role === "assistant" && Array.isArray(msg.toolInvocations)) {
            const filteredToolInvocations = msg.toolInvocations.filter(
              invocation => invocation.state === "result"
            );
            return {
              ...msg,
              toolInvocations: filteredToolInvocations,
            };
          }
          return msg;
        })
        .filter(msg => {
          if (
            msg.role === "assistant" &&
            !msg.content?.trim() &&
            (!msg.toolInvocations || msg.toolInvocations.length === 0)
          ) {
            return false;
          }
          return true;
        });

      return updatedMessages;
    });
  }, [setMessages]);

  const handleStop = useCallback(() => {
    stop();
    removeIncompleteToolCalls();
  }, [stop, removeIncompleteToolCalls]);

  // Reuse the same handler from NavBar for consistency
  const handleNewChat = useCallback(() => {
    router.push("/");
  }, [router]);

  // Effect for scrolling to bottom when isLoading changes
  useEffect(() => {
    if (isLoading && scrollAreaRef.current?.children[0]) {
      const messagesContainer = scrollAreaRef.current.children[0];
      messagesContainer.scrollTop = messagesContainer.scrollHeight - messagesContainer.clientHeight;
      setIsAtBottom(true);
    }
  }, [isLoading]);

  // Effect to handle initial message on mount
  useEffect(() => {
    async function handleInitialMessage() {
      if (initialMessage && !currentSession?.id && !isSubmitting) {
        setIsSubmitting(true);
        // Create new session
        await createSession();
      }
    }

    handleInitialMessage();
  }, [initialMessage, currentSession?.id, isSubmitting, createSession]);

  // Add effect to handle session expiration
  useEffect(() => {
    if (isExpired) {
      stop();
      removeIncompleteToolCalls();
    }
  }, [isExpired, stop, removeIncompleteToolCalls]);

  // Restore the watch for pause messages effect
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.info("🔍 Checking message for pause:", {
        content: lastMessage.content,
        role: lastMessage.role,
        toolInvocations: lastMessage.toolInvocations,
        isPausedState: isPaused,
        currentReason: pauseReason,
        totalMessages: messages.length,
      });

      // Log all tool calls for debugging
      if (lastMessage.toolInvocations?.length) {
        console.info(
          "🛠️ All tool calls in last message:",
          lastMessage.toolInvocations.map(tool => ({
            toolName: tool.toolName,
            args: tool.args,
            state: tool.state,
          }))
        );
      }

      // Check if this is a pause message
      if (lastMessage.role === "assistant") {
        // Check for pause tool call
        let foundPause = false;
        let pauseReasonText = "";

        if (lastMessage.toolInvocations?.length) {
          const pauseToolCall = lastMessage.toolInvocations.find(
            tool => tool.toolName === "pause_execution"
          );

          if (pauseToolCall) {
            foundPause = true;
            // If reason starts with emoji, keep it (improved extraction)
            pauseReasonText =
              typeof pauseToolCall.args.reason === "string"
                ? pauseToolCall.args.reason
                : "Unknown reason";

            console.info("⏸️ Found pause tool call:", {
              toolCall: pauseToolCall,
              extractedReason: pauseReasonText,
            });
          }
        }
        // Also check for pause message in content
        else if (lastMessage.content && lastMessage.content.includes("⏸️ Pausing execution")) {
          foundPause = true;
          if (lastMessage.content.includes("⏸️ Pausing execution:")) {
            const parts = lastMessage.content.split("⏸️ Pausing execution:");
            pauseReasonText = parts[1]?.trim() || "Unknown reason";
          } else {
            pauseReasonText = lastMessage.content.trim();
          }
          console.info("⏸️ Found pause message in content:", {
            extractedReason: pauseReasonText,
          });
        }

        if (foundPause) {
          setIsPaused(true);
          setPauseReason(pauseReasonText);

          // Stop loading state when paused
          if (isLoading) {
            stop();
            removeIncompleteToolCalls();
          }

          // Skip the type checking for this console.info call
          (console.info as any)(
            "🔍 Current pause messages:",
            messages.filter(m => {
              return (
                m.content?.includes("⏸️ Pausing execution") ||
                m.toolInvocations?.some(tool => tool.toolName === "pause_execution")
              );
            }).length
          );

          // Don't add an extra message - use the existing tool call message instead
          console.info("⏸️ Using existing pause message from tool call");
        }
      }
    }
  }, [messages, isPaused, pauseReason, isLoading, stop, removeIncompleteToolCalls]);

  // Restore the browser paused effect
  useEffect(() => {
    const handleBrowserPaused = (event: CustomEvent) => {
      console.info("🖐️ Browser was manually paused by user:", event.detail);
      setIsPaused(true);
      setPauseReason("You have taken control of the browser");

      // Make sure loading state is cleared if active
      if (isLoading) {
        stop();
        removeIncompleteToolCalls();
      }

      // Add a message to the chat to indicate manual pause
      setMessages(messages => [
        ...messages,
        {
          id: `manual-pause-${Date.now()}`,
          role: "assistant",
          content: "⏸️ You have taken control of the browser.",
        },
      ]);
    };

    // Add browser-paused event listener
    window.addEventListener("browser-paused", handleBrowserPaused as EventListener);

    return () => {
      window.removeEventListener("browser-paused", handleBrowserPaused as EventListener);
    };
  }, [isLoading, stop, removeIncompleteToolCalls, setMessages]);

  // Add a function to handle message refreshing
  const refreshMessages = useCallback(async () => {
    if (!currentSession?.id) return;

    try {
      console.info("🔄 Refreshing messages for session:", currentSession.id);

      // Use the reload function, which will fetch the latest messages
      await reload();

      // After reload completes, check for and handle any duplicate resume messages
      setMessages(prev => {
        // Find all resume messages
        const resumeMessages = prev.filter(
          m => m.role === "assistant" && m.content === "▶️ AI control has been resumed."
        );

        // If there are multiple resume messages in sequence, keep only the last one
        if (resumeMessages.length > 1) {
          console.info(`🔄 Found ${resumeMessages.length} resume messages, deduplicating...`);

          let lastResumeIndex = -1;
          const messagesToKeep = prev.filter((message, index) => {
            const isResumeMessage =
              message.role === "assistant" && message.content === "▶️ AI control has been resumed.";

            if (isResumeMessage) {
              if (lastResumeIndex !== -1 && index === lastResumeIndex + 1) {
                // This is a consecutive resume message, skip it
                lastResumeIndex = index;
                return false;
              }
              lastResumeIndex = index;
            }

            return true;
          });

          return messagesToKeep;
        }

        return prev;
      });
    } catch (error) {
      console.error("❌ Error refreshing messages:", error);
    }
  }, [currentSession?.id, reload, setMessages]);

  // Update the handleResume function to use the refreshMessages function
  const handleResume = useCallback(async () => {
    if (!currentSession?.id) {
      return;
    }

    // Prevent duplicate resume calls
    const now = Date.now();
    const timeSinceLastResume = now - lastResumeTimestamp.current;

    // If less than 3 seconds since last resume, ignore this request
    if (timeSinceLastResume < 3000) {
      console.warn(
        `🔒 Ignoring duplicate resume request (${timeSinceLastResume}ms since last resume)`
      );
      return;
    }

    // Check if a resume request is already in progress
    if (resumeRequestInProgress.current || resumeLoading) {
      console.warn("🔒 Resume request already in progress, ignoring duplicate request");
      return;
    }

    try {
      // Update the last resume timestamp
      lastResumeTimestamp.current = now;

      // Set the lock
      resumeRequestInProgress.current = true;
      setResumeLoading(true);
      setIsPaused(false);
      setPauseReason("");

      console.info("▶️ Resuming session:", currentSession.id);

      // Add a single resume message
      setMessages(prev => {
        // Check if the last message is already a resume message to avoid duplicates
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.content === "▶️ AI control has been resumed.") {
          return prev;
        }
        return [
          ...prev,
          {
            id: `resume-${Date.now()}`,
            role: "assistant",
            content: "▶️ AI control has been resumed.",
          },
        ];
      });

      // Trigger a single browser-resumed event
      window.dispatchEvent(
        new CustomEvent("browser-resumed", {
          detail: { sessionId: currentSession.id },
        })
      );

      // Make a single API call to resume
      console.info(`🔄 Sending resume request for session: ${currentSession.id}`);
      const response = await fetch(`/api/sessions/${currentSession.id}/resume`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Resume API call failed:", {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        throw new Error("Failed to resume execution");
      }

      // Success notification
      toast({
        title: "Resumed",
        description: "Execution resumed",
        className: "border border-[--green-6] bg-[--green-3] text-[--green-11]",
      });

      // Add a delayed refresh to get updated messages, but leave a buffer for the system to process
      setTimeout(() => {
        refreshMessages();

        // Release the lock after refresh is triggered
        setTimeout(() => {
          setResumeLoading(false);
          resumeRequestInProgress.current = false;
        }, 500);
      }, 1500);
    } catch (error) {
      console.error("❌ Error resuming execution:", error);

      // Reset state on error
      setIsPaused(true);
      setPauseReason("Failed to resume. Try again.");
      setResumeLoading(false);
      resumeRequestInProgress.current = false;

      toast({
        title: "Error",
        description: "Failed to resume execution",
        className: "border border-[--red-6] bg-[--red-3] text-[--red-11]",
      });
    }
  }, [currentSession?.id, toast, resumeLoading, setMessages, refreshMessages]);

  // Now add the browser-resumed event listener after handleResume is defined
  useEffect(() => {
    const handleBrowserResumed = (event: CustomEvent) => {
      console.info("▶️ Browser AI control was resumed by user:", event.detail);

      // Only proceed if no resume is in progress
      if (!resumeRequestInProgress.current) {
        handleResume();
      } else {
        console.warn("🔒 Ignoring browser-resumed event: resume already in progress");
      }
    };

    // Add event listeners for browser events
    window.addEventListener("browser-resumed", handleBrowserResumed as EventListener);

    return () => {
      window.removeEventListener("browser-resumed", handleBrowserResumed as EventListener);
    };
  }, [handleResume]);

  // Return the memoized content with the dialog
  return (
    <>
      <ChatPageContent
        messages={messages}
        isLoading={isLoading}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        handleStop={handleStop}
        reload={reload}
        isCreatingSession={isCreatingSession}
        hasShownConnection={hasShownConnection}
        currentSession={currentSession}
        isExpired={isExpired}
        handleNewChat={handleNewChat}
        handleImageClick={handleImageClick}
        setMessages={setMessages}
        isAtBottom={isAtBottom}
        scrollAreaRef={scrollAreaRef}
        handleScroll={handleScroll}
        removeIncompleteToolCalls={removeIncompleteToolCalls}
        stop={stop}
        handleSend={handleSend}
        isPaused={isPaused}
        resumeLoading={resumeLoading}
        handleResume={handleResume}
      />

      {/* Modal for expanded image */}
      <Dialog open={selectedImage !== null} onOpenChange={open => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-[90vw] border border-[#282828] bg-[--gray-1] p-0">
          <div className="flex items-center justify-between border-b border-[#282828] px-4 py-2">
            <DialogTitle className="text-base font-medium text-[--gray-12]">
              Page preview sent to model
            </DialogTitle>
            <button
              onClick={() => setSelectedImage(null)}
              className="text-[--gray-11] transition-colors hover:text-[--gray-12]"
            >
              Close
            </button>
          </div>
          {selectedImage && (
            <div className="p flex items-center justify-center" style={{ height: "80vh" }}>
              <img
                src={selectedImage}
                alt="Preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* API Key Modal */}
      <AuthModal
        provider={currentSettings?.selectedProvider || ""}
        isOpen={showApiKeyModal}
        onSubmit={handleApiKeySubmit}
      />
    </>
  );
}
