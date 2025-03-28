"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { CheckIcon } from "@radix-ui/react-icons";
import { useChat } from "ai/react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { MarkdownText } from "@/components/markdown";
import { Browser } from "@/components/ui/Browser";
import { Button } from "@/components/ui/button";
import { ChatInput } from "@/components/ui/ChatInput";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ToolInvocations } from "@/components/ui/tool";

import { useToast } from "@/hooks/use-toast";

import { useChatContext } from "@/app/contexts/ChatContext";
import { useSettings } from "@/app/contexts/SettingsContext";
import { useSteelContext } from "@/app/contexts/SteelContext";

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
                          // Consider both cases:
                          // 1. A message comes after this one in the messages array
                          // 2. The isPaused state is false (meaning we've already resumed)
                          return (i > index && m.role === "user") || !isPaused;
                        });

                        // Only show buttons if this is the latest pause, no user message after it, and isPaused is true
                        const showButtons =
                          isLatestPauseMessage && !userSentMessageAfterPause && isPaused;

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
                          globalIsPaused: isPaused,
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
                                    {isPaused
                                      ? "(Confirmation no longer needed)"
                                      : "(Action has been taken)"}
                                  </div>
                                )}
                              </div>
                              {showButtons && (
                                <div className="flex gap-3">
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

    // State for image overlay dialog
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Handle image click for dialog
    const handleLocalImageClick = (src: string) => {
      setSelectedImage(src);
      handleImageClick(src);
    };

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
                  onImageClick={handleLocalImageClick}
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

        {/* Modal for expanded image */}
        <Dialog
          open={selectedImage !== null}
          onOpenChange={open => !open && setSelectedImage(null)}
        >
          <DialogContent className="max-w-[90vw] border border-[#282828] bg-[--gray-1] p-0">
            <div className="flex items-center justify-between border-b border-[#282828] px-4 py-2">
              <DialogTitle className="text-base font-medium text-[--gray-12]">
                Page preview sent to model
              </DialogTitle>
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

  // Add a ref to track processed messages for pause detection
  const processedPauseMessagesRef = useRef<Set<string>>(new Set());
  const lastResumeMessageIdRef = useRef<string | null>(null);

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

  // Keep the regular refreshMessages function for cases where we don't need duplicate checking
  const refreshMessages = useCallback(async () => {
    if (!currentSession?.id) return;

    try {
      console.info("🔄 Refreshing messages for session:", currentSession.id);

      // Use the reload function to fetch the latest messages
      await reload();

      // Basic deduplication of resume messages
      setMessages(prev => {
        // Find and handle consecutive resume messages
        let lastResumeIndex = -1;
        return prev.filter((message, index) => {
          const isResumeMessage =
            message.role === "assistant" && message.content === "▶️ AI control has been resumed.";

          if (isResumeMessage) {
            if (lastResumeIndex !== -1 && index === lastResumeIndex + 1) {
              // Skip consecutive resume messages
              return false;
            }
            lastResumeIndex = index;
          }

          return true;
        });
      });
    } catch (error) {
      console.error("❌ Error refreshing messages:", error);
    }
  }, [currentSession?.id, reload, setMessages]);

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

      // Save the message for later
      const savedMessage = messageText;

      // Clear the input immediately to prevent reappearing
      handleInputChange({ target: { value: "" } } as any);

      // Make a stable copy of the current messages for reference
      const currentMessages = [...messages];

      // Check if there are any pending pause messages that need to be displayed
      const hasPendingPauseMessages = currentMessages.some(
        m =>
          (m.role === "assistant" &&
            (m.content?.includes("⏸️") || m.content?.includes("CONFIRMATION REQUIRED:"))) ||
          m.toolInvocations?.some(tool => tool.toolName === "pause_execution")
      );

      if (hasPendingPauseMessages) {
        console.info("🔄 Found pending pause messages, ensuring they're displayed");
        // Force a UI update with the existing messages to make pause messages visible
        setMessages([...currentMessages]);
        // Give UI time to update
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // Resume the agent, which will also add a resume message
      await handleResume();

      // Add a delay to ensure the resume has been processed by the backend
      await new Promise(resolve => setTimeout(resolve, 800));

      // Turn off resume loading indicator since we'll now use the regular loading state
      setResumeLoading(false);

      try {
        // Get current messages after resume to maintain correct order
        const messagesAfterResume = [...messages];

        // Log messages for debugging
        console.info(
          "🔍 Messages after resume:",
          messagesAfterResume.map(m => ({
            role: m.role,
            content: m.content.substring(0, 30) + (m.content.length > 30 ? "..." : ""),
            id: m.id,
          }))
        );

        // Create a unique ID for this user message to help with debugging and deduplication
        const userMessageId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Add the user message to UI with proper type assertion and unique ID
        const userMessage = {
          id: userMessageId,
          role: "user" as const, // Use const assertion to fix the type error
          content: savedMessage,
        };

        console.info("📝 Adding user message with ID:", userMessageId);

        // Update the UI in one deterministic operation
        setMessages([...messagesAfterResume, userMessage]);

        // Now submit directly to the API if we have a session
        if (currentSession?.id) {
          console.info("📤 Submitting message to API after resume:", savedMessage);

          // Create a copy of messages that ensures the user message has the correct role
          const messagesToSend = [
            ...messagesAfterResume,
            {
              id: userMessageId,
              role: "user",
              content: savedMessage,
            },
          ];

          // Direct API call to send the message
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: messagesToSend,
              ...chatBodyConfig,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to send message: ${response.statusText}`);
          }

          // Refresh messages after a longer delay to get the latest responses
          // This should allow enough time for the backend to process the message
          setTimeout(() => {
            console.info("🔄 Refreshing messages after resume + user message");
            // Use a custom refresh function that prevents duplicate user messages
            refreshMessagesWithDuplicateCheck(savedMessage);
          }, 1000); // Increase the delay to ensure proper message ordering
        }
      } catch (error) {
        console.error("Error sending message:", error);
        toast({
          title: "Error",
          description: "Failed to send your message",
          className: "border border-[--red-6] bg-[--red-3] text-[--red-11]",
        });
      }

      return;
    }

    // Normal flow when not paused
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

      // Skip if we've already processed this message
      if (lastMessage.id && processedPauseMessagesRef.current.has(lastMessage.id)) {
        return;
      }

      // Skip pause detection if we've recently resumed
      if (lastResumeMessageIdRef.current) {
        const resumeIndex = messages.findIndex(m => m.id === lastResumeMessageIdRef.current);
        const lastMessageIndex = messages.length - 1;

        // If the last resume message is after or the same as this message, skip
        if (resumeIndex >= 0 && resumeIndex >= lastMessageIndex - 1) {
          return;
        }
      }

      console.info("🔍 Checking message for pause:", {
        id: lastMessage.id,
        content: lastMessage.content?.substring(0, 30),
        role: lastMessage.role,
        isPausedState: isPaused,
        currentReason: pauseReason,
        messagesLength: messages.length,
        alreadyProcessed: lastMessage.id
          ? processedPauseMessagesRef.current.has(lastMessage.id)
          : false,
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
        } else if (lastMessage.content && lastMessage.content.includes("CONFIRMATION REQUIRED:")) {
          // Also check for confirmation required messages
          foundPause = true;
          pauseReasonText = lastMessage.content;
          console.info("⏸️ Found confirmation required message:", {
            content: lastMessage.content,
          });
        } else if (
          lastMessage.content &&
          lastMessage.content.includes("⏸️ You have taken control")
        ) {
          foundPause = true;
          pauseReasonText = "You have taken control of the browser";
          console.info("⏸️ Found manual pause message:", {
            content: lastMessage.content,
          });
        }

        if (foundPause) {
          // Mark this message as processed
          if (lastMessage.id) {
            processedPauseMessagesRef.current.add(lastMessage.id);
          }

          setIsPaused(true);
          setPauseReason(pauseReasonText);

          // Stop loading state when paused
          if (isLoading) {
            stop();
            removeIncompleteToolCalls();
          }

          // Don't add an extra message - use the existing tool call message instead
          console.info("⏸️ Using existing pause message from tool call");
        }
        // Check if this is a resume message
        else if (lastMessage.content === "▶️ AI control has been resumed.") {
          // Mark as processed and remember as the last resume message
          if (lastMessage.id) {
            processedPauseMessagesRef.current.add(lastMessage.id);
            lastResumeMessageIdRef.current = lastMessage.id;
          }

          // Reset pause state
          setIsPaused(false);
          setPauseReason("");
          console.info("▶️ Resume message detected, reset pause state");
        }
      }
    }
  }, [messages, isLoading, stop, removeIncompleteToolCalls]);

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

  // The specialized version with duplicate checking
  const refreshMessagesWithDuplicateCheck = useCallback(
    async (userMessage?: string) => {
      if (!currentSession?.id) return;

      try {
        console.info("🔄 Refreshing messages with duplicate check:", currentSession.id);

        // Use the reload function to fetch the latest messages
        await reload();

        // Clean up and deduplicate messages
        setMessages(prev => {
          // Make a copy of the messages for processing
          let messages = [...prev];

          // Log current message state for debugging
          console.info(
            "🔍 Messages before cleanup:",
            messages.map(m => ({
              role: m.role,
              content: m.content.substring(0, 30) + (m.content.length > 30 ? "..." : ""),
              id: m.id,
            }))
          );

          // 1. Handle duplicate resume messages
          let resumeIndices: number[] = [];
          messages.forEach((m, i) => {
            if (m.role === "assistant" && m.content === "▶️ AI control has been resumed.") {
              resumeIndices.push(i);
            }
          });

          // Keep only the first resume message in each consecutive group
          if (resumeIndices.length > 1) {
            console.info(`🔄 Found ${resumeIndices.length} resume messages, deduplicating...`);
            let lastIndex = -2;
            const indicesToRemove: number[] = [];

            for (const idx of resumeIndices) {
              if (idx === lastIndex + 1) {
                // This is a consecutive resume message, mark for removal
                indicesToRemove.push(idx);
              }
              lastIndex = idx;
            }

            // Remove marked messages
            messages = messages.filter((_, i) => !indicesToRemove.includes(i));
          }

          // 2. Prevent duplicate user messages and fix any messages with the wrong role
          if (userMessage) {
            // Find all messages with this content regardless of role
            const messagesWithSameContent = messages.filter(m => m.content === userMessage);

            console.info(
              `🔍 Found ${messagesWithSameContent.length} messages with content "${userMessage.substring(0, 30)}..."`
            );

            if (messagesWithSameContent.length > 0) {
              // Check if any of them have the wrong role (assistant instead of user)
              const wrongRoleMessages = messagesWithSameContent.filter(m => m.role === "assistant");

              if (wrongRoleMessages.length > 0) {
                console.info(
                  `⚠️ Found ${wrongRoleMessages.length} messages with wrong role (assistant instead of user)`
                );

                // Fix roles: ensure the latest message with this content has role "user"
                let foundUserMessage = false;

                // First pass: check if we already have a proper user message
                for (const m of messagesWithSameContent) {
                  if (m.role === "user") {
                    foundUserMessage = true;
                    break;
                  }
                }

                // Second pass: if no user message exists, convert the latest one
                if (!foundUserMessage && wrongRoleMessages.length > 0) {
                  const latestWrongMessage = wrongRoleMessages[wrongRoleMessages.length - 1];
                  const index = messages.findIndex(m => m.id === latestWrongMessage.id);

                  if (index !== -1) {
                    console.info(
                      `🔧 Converting message at index ${index} from assistant to user role`
                    );
                    messages[index] = {
                      ...messages[index],
                      role: "user",
                      id: `user-${Date.now()}-fixed`,
                    };
                  }
                }
              }

              // Now handle duplicates - keep only one user message with this content
              let foundUserMessage = false;
              messages = messages.filter(m => {
                if (m.content === userMessage) {
                  if (m.role === "user") {
                    if (!foundUserMessage) {
                      foundUserMessage = true;
                      return true;
                    }
                    return false; // Remove duplicate user messages
                  }
                }
                return true;
              });
            } else {
              // If no messages with this content exist yet, we might need to add it
              console.info(
                `ℹ️ No messages found with content "${userMessage.substring(0, 30)}..."`
              );
            }
          }

          // Log final state after cleanup
          console.info(
            "🔍 Messages after cleanup:",
            messages.map(m => ({
              role: m.role,
              content: m.content.substring(0, 30) + (m.content.length > 30 ? "..." : ""),
              id: m.id,
            }))
          );

          return messages;
        });
      } catch (error) {
        console.error("❌ Error refreshing messages:", error);
      }
    },
    [currentSession?.id, reload, setMessages]
  );

  // Update the handleResume function to clear processed messages on resume
  const handleResume = useCallback(
    async (fromEvent = false) => {
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

        // Set the lock and update UI state
        resumeRequestInProgress.current = true;
        setResumeLoading(true);

        // Update UI state to show we're not paused - do this first for consistency
        setIsPaused(false);
        setPauseReason("");

        console.info("▶️ Resuming session:", currentSession.id);

        // Get a stable copy of current messages before adding resume message
        const currentMessages = [...messages];

        // Check if the last message is already a resume message
        const lastMessage =
          currentMessages.length > 0 ? currentMessages[currentMessages.length - 1] : null;
        const isLastMessageResume =
          lastMessage && lastMessage.content === "▶️ AI control has been resumed.";

        // Only add a resume message if the last message isn't already one
        if (!isLastMessageResume) {
          const resumeMessage = {
            id: `resume-${Date.now()}`,
            role: "assistant" as const, // Use const assertion to fix the type error
            content: "▶️ AI control has been resumed.",
          };

          // Remember the resume message ID to prevent re-processing pause messages
          lastResumeMessageIdRef.current = resumeMessage.id;

          // Update messages in one operation to avoid flicker
          setMessages([...currentMessages, resumeMessage]);
        }

        // If this resume call was triggered directly, notify the browser component
        if (!fromEvent) {
          console.info("🔄 Dispatching browser-resumed event from direct button click");
          window.dispatchEvent(
            new CustomEvent("browser-resumed", {
              detail: { sessionId: currentSession.id },
            })
          );
        }

        // Make API call to resume
        console.info("🔄 Sending resume request for session:", currentSession.id);
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

        // Add a delayed refresh to get updated messages
        setTimeout(() => {
          refreshMessages();

          // Release the lock after refresh is triggered
          setTimeout(() => {
            resumeRequestInProgress.current = false;
            // Always turn off resumeLoading after a successful resume
            setResumeLoading(false);
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
    },
    [currentSession?.id, messages, toast, resumeLoading, setMessages, refreshMessages]
  );

  // Add browser-resumed event listener after handleResume is defined
  useEffect(() => {
    const handleBrowserResumed = (event: CustomEvent) => {
      console.info("🖐️ Browser was manually resumed by user:", event.detail);

      // Call the handleResume function with fromEvent=true to indicate this came from Browser
      handleResume(true);
    };

    // Add browser-resumed event listener
    window.addEventListener("browser-resumed", handleBrowserResumed as EventListener);

    return () => {
      window.removeEventListener("browser-resumed", handleBrowserResumed as EventListener);
    };
  }, [handleResume]);

  // Add effect to turn off resumeLoading when agent responds
  useEffect(() => {
    // If we were showing loading (isLoading=true) and then loading stops (isLoading=false)
    // and resumeLoading is still true, it means we should turn off resumeLoading
    if (!isLoading && resumeLoading) {
      console.info("🔄 Agent has responded, turning off resumeLoading");

      // Brief delay to make sure any UI updates from the response are rendered first
      setTimeout(() => {
        resumeRequestInProgress.current = false;
        setResumeLoading(false);
      }, 300);
    }
  }, [isLoading, resumeLoading]);

  // Add safety check to ensure messages have correct roles
  useEffect(() => {
    // Skip empty messages array
    if (!messages.length) return;

    // Check if any recent user messages were incorrectly relayed as assistant messages
    const lastFewMessages = messages.slice(-5); // Check only the last 5 messages

    let needsFix = false;
    const knownUserTexts = new Map<string, number>(); // Track known user messages by content

    // First pass: identify user messages
    lastFewMessages.forEach((message, index) => {
      if (message.role === "user") {
        knownUserTexts.set(message.content, index);
      }
    });

    // Second pass: check if any assistant messages contain exact user message content
    lastFewMessages.forEach((message, index) => {
      if (
        message.role === "assistant" &&
        knownUserTexts.has(message.content) &&
        // Don't flag resume messages
        message.content !== "▶️ AI control has been resumed." &&
        !message.content.startsWith("⏸️") &&
        !message.content.includes("CONFIRMATION REQUIRED:")
      ) {
        needsFix = true;
        console.warn(
          `⚠️ Found likely user message with incorrect role (assistant): "${message.content.substring(0, 30)}..."`
        );
      }
    });

    // If issues found, run the message sanitizer
    if (needsFix) {
      console.info("🔧 Fixing message roles");
      setMessages(prev => {
        return prev.map(message => {
          // If this is an assistant message but matches a known user message content
          if (
            message.role === "assistant" &&
            knownUserTexts.has(message.content) &&
            message.content !== "▶️ AI control has been resumed." &&
            !message.content.startsWith("⏸️") &&
            !message.content.includes("CONFIRMATION REQUIRED:")
          ) {
            // Fix its role
            return {
              ...message,
              role: "user" as const,
              id: `user-${Date.now()}-fixed-${Math.random().toString(36).substring(2, 7)}`,
            };
          }
          return message;
        });
      });
    }
  }, [messages]);

  return (
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
  );
}
