"use client";

import { useChat } from "ai/react";
import { useSettings } from "@/app/contexts/SettingsContext";
import { useSteelContext } from "@/app/contexts/SteelContext";
import { ChatInput } from "@/components/ui/ChatInput";
import { useEffect, useState, useRef } from "react";
import { useChatContext } from "@/app/contexts/ChatContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CheckIcon } from "@radix-ui/react-icons";
import { ToolInvocations } from "@/components/ui/tool";
import { useInView } from "react-intersection-observer";
import { Browser } from "@/components/ui/Browser";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserMessageProps {
  content: string;
}

function UserMessage({ content }: UserMessageProps) {
  const hasLineBreaks = content.includes("\n");
  const longestLine = Math.max(
    ...content.split("\n").map((line) => line.length)
  );
  const isLongMessage = longestLine > 60;

  return (
    <div className="flex justify-end">
      <div
        className={`
          inline-flex p-3
          ${
            isLongMessage || hasLineBreaks
              ? "rounded-3xl max-w-[85%]"
              : "rounded-full px-4"
          }
          bg-[--blue-9] shrink-0
        `}
      >
        <div
          className={`
            text-[--gray-12] text-base font-normal 
            font-['Geist'] leading-normal whitespace-pre-wrap
            break-words max-w-full
          `}
        >
          {content}
        </div>
      </div>
    </div>
  );
}

/**
 * ChatScrollAnchor:
 * - Used with Intersection Observer to track visibility of the bottom of the chat.
 * - If isAtBottom and trackVisibility are both true, it automatically scrolls
 *   the chat area to bottom whenever the anchor is out of view (new messages).
 */
interface ChatScrollAnchorProps {
  trackVisibility: boolean; // typically matches isLoading
  isAtBottom: boolean;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
}

function ChatScrollAnchor({
  trackVisibility,
  isAtBottom,
  scrollAreaRef,
}: ChatScrollAnchorProps) {
  const { ref, inView } = useInView({
    trackVisibility,
    delay: 100,
  });

  useEffect(() => {
    if (
      isAtBottom &&
      trackVisibility &&
      !inView &&
      scrollAreaRef.current?.children[0]
    ) {
      const messagesContainer = scrollAreaRef.current.children[0];
      messagesContainer.scrollTop =
        messagesContainer.scrollHeight - messagesContainer.clientHeight;
    }
  }, [inView, isAtBottom, trackVisibility]);

  return <div ref={ref} className="h-px w-full" />;
}

export default function ChatPage() {
  const { currentSettings } = useSettings();
  const {
    currentSession,
    createSession,
    isCreatingSession,
    isExpired,
    resetSession,
  } = useSteelContext();
  const { initialMessage, setInitialMessage, clearInitialState } =
    useChatContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasShownConnection, setHasShownConnection] = useState(false);
  const router = useRouter();

  const {
    messages,
    handleSubmit,
    isLoading,
    input,
    handleInputChange,
    setMessages,
    reload,
    stop,
  } = useChat({
    api: "/api/chat",
    id: currentSession?.id || undefined,
    maxSteps: 10,
    initialMessages: initialMessage
      ? [{ id: "1", role: "user", content: initialMessage }]
      : undefined,
    body: {
      session_id: currentSession?.id,
      agent_type: currentSettings?.selectedAgent,
      provider: currentSettings?.selectedProvider,
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
          .filter(
            ([_, value]) => value !== undefined && !isSettingConfig(value)
          )
          .map(([key, value]) => [
            key,
            typeof value === "string" ? value : Number(value),
          ])
      ),
    },
    onFinish: (message) => {
      console.log("Chat FINISHED:", message);
    },
    onError: (error) => {
      console.error("Chat error:", error);
    },
    onToolCall: (toolCall) => {
      console.log("Chat tool call:", toolCall);
    },
  });

  // Track whether user is at the bottom
  const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
  // Reference to the scroll container
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    if (!scrollAreaRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } =
      scrollAreaRef.current.children[0];
    const atBottom = scrollHeight - clientHeight <= scrollTop + 1;

    setIsAtBottom(atBottom);
  }

  // If user is sending a message (isLoading = true), scroll to bottom
  useEffect(() => {
    if (isLoading) {
      if (!scrollAreaRef.current?.children[0]) {
        console.log("messages container is null; cannot scroll");
        return;
      }
      const messagesContainer = scrollAreaRef.current.children[0];
      messagesContainer.scrollTop =
        messagesContainer.scrollHeight - messagesContainer.clientHeight;
      setIsAtBottom(true);
    }
  }, [isLoading]);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImageClick = (imageSrc: string) => {
    setSelectedImage(imageSrc);
  };

  // Unified handleSend: create session if needed, then submit the message
  async function handleSend(
    e: React.FormEvent,
    messageText: string,
    attachments: File[]
  ) {
    e.preventDefault();
    setIsSubmitting(true);
    if (messages.length === 0) {
      setInitialMessage(messageText);
      handleInputChange({ target: { value: "" } } as any);
    } else {
      handleSubmit(e);
      return;
    }
    // Ensure we have a session first
    let session = currentSession;
    if (!session?.id) {
      session = await createSession();
    }
  }

  // Add new useEffect to handle initial message on mount
  useEffect(() => {
    async function handleInitialMessage() {
      if (initialMessage && !currentSession?.id && !isSubmitting) {
        setIsSubmitting(true);
        // Create new session
        await createSession();
      }
    }

    handleInitialMessage();
  }, [initialMessage, currentSession?.id, isSubmitting]);

  // Modify the useEffect that handles session creation
  useEffect(() => {
    const isNewSession = currentSession?.id && !hasShownConnection;
    if (isNewSession) {
      reload();
      setIsSubmitting(false);
      setInitialMessage(null);
      setHasShownConnection(true);
    }
  }, [currentSession?.id, hasShownConnection]);

  // Example callback to remove incomplete tool calls
  function removeIncompleteToolCalls() {
    setMessages((prev) => {
      // For each assistant message, we can remove any toolInvocations that haven't yielded a final result.
      // According to the Vercel AI SDK docs, a completed invocation has "state" === "result".
      // Partial calls might have "state" === "partial-call" or "call" (no final result yet).

      return prev
        .map((msg) => {
          // Only adjust assistant messages that have toolInvocations
          if (msg.role === "assistant" && Array.isArray(msg.toolInvocations)) {
            // Filter out incomplete tool calls
            const filteredToolInvocations = msg.toolInvocations.filter(
              (invocation) => invocation.state === "result"
            );

            // Return a new message object with updated toolInvocations
            return {
              ...msg,
              toolInvocations: filteredToolInvocations,
            };
          }

          // For all other messages (user role, system role, etc.), we leave them unchanged
          return msg;
        })
        .filter((msg) => {
          // Optionally remove entire assistant messages if they have no text AND no completed tool calls
          if (
            msg.role === "assistant" &&
            !msg.content?.trim() &&
            (!msg.toolInvocations || msg.toolInvocations.length === 0)
          ) {
            return false;
          }
          return true;
        });
    });
  }

  function handleStop() {
    stop();
    removeIncompleteToolCalls();
  }

  // Helper function to check if a value is a setting config object
  function isSettingConfig(value: any): boolean {
    return (
      value &&
      typeof value === "object" &&
      "type" in value &&
      "default" in value
    );
  }

  // Reuse the same handler from NavBar for consistency
  const handleNewChat = async () => {
    router.push("/");
  };

  // Add effect to handle session expiration
  useEffect(() => {
    if (isExpired) {
      stop();
      removeIncompleteToolCalls();
    }
  }, [isExpired]); // Only re-run when isExpired changes

  return (
    <>
      <div className="flex flex-col-reverse md:flex-row h-[calc(100vh-3.5rem)]">
        {/* Left (chat) - Set min/max width for desktop, full width on mobile */}
        <div
          className="
          flex flex-col 
          w-full md:w-[400px] md:min-w-[400px] md:max-w-[400px]
          h-[60vh] md:h-full
          border-t md:border-t-0 md:border-r border-[--gray-3]
        "
        >
          <div
            className="flex-1 overflow-hidden"
            ref={scrollAreaRef}
            onScroll={handleScroll}
          >
            <div
              className="flex flex-col gap-4 h-full overflow-y-auto overflow-x-hidden p-4 w-full
                [&::-webkit-scrollbar]:w-1.5
                [&::-webkit-scrollbar-track]:bg-[--gray-1]
                [&::-webkit-scrollbar-track]:rounded-full
                [&::-webkit-scrollbar-thumb]:bg-[--gray-3]
                [&::-webkit-scrollbar-thumb]:rounded-full
                [&::-webkit-scrollbar-thumb]:border-4
                [&::-webkit-scrollbar-thumb]:hover:bg-[--gray-3]
                [&::-webkit-scrollbar-thumb]:transition-colors
                scrollbar-gutter-stable
                scrollbar-thin"
            >
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className="flex flex-col gap-2 w-full max-w-full"
                >
                  {/* Force message content to respect container width */}
                  <div className="w-full max-w-full">
                    {message.role === "user" ? (
                      <>
                        <UserMessage content={message.content} />
                        {index === 0 && isCreatingSession && (
                          <div className="px-4 py-2 bg-[--blue-2] text-[--blue-11] border border-[--blue-3] rounded-md text-sm animate-pulse w-[85%] mx-auto mt-2">
                            Connecting to Steel Browser Session...
                          </div>
                        )}
                        {index === 0 &&
                          hasShownConnection &&
                          !isCreatingSession &&
                          currentSession?.id && (
                            <div className="px-4 py-2 bg-[--green-2] text-[--green-11] border border-[--green-3] rounded-md text-sm flex items-center gap-2 w-[85%] mx-auto mt-2">
                              <CheckIcon className="h-4 w-4" />
                              Steel Browser Session connected
                            </div>
                          )}
                      </>
                    ) : (
                      <div className="flex flex-col gap-2 text-base text-[--gray-12] w-full max-w-full break-words">
                        {message.content && (
                          <div className="w-full max-w-full break-words">
                            {message.content}
                          </div>
                        )}
                        {message.toolInvocations?.length ? (
                          <div className="flex flex-col gap-2 border border-[--gray-3] rounded-[20px] p-2 bg-[--gray-1] w-full max-w-full">
                            <ToolInvocations
                              toolInvocations={message.toolInvocations}
                              onImageClick={handleImageClick}
                            />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {message.experimental_attachments?.map((attachment, idx) => (
                    <div
                      key={idx}
                      className="
                        mt-1
                        inline-flex
                        h-8 px-2
                        bg-[--gray-2]
                        rounded-full
                        border
                        border-[--gray-3]
                        items-center
                        gap-2
                      "
                    >
                      <span className="text-[--gray-11] text-sm font-normal font-['Geist'] leading-[18px]">
                        {attachment.name}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              {isLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-[--gray-12] border-t-transparent" />
              )}

              {/* Simplified scroll anchor */}
              <ChatScrollAnchor
                scrollAreaRef={scrollAreaRef}
                isAtBottom={isAtBottom}
                trackVisibility={isLoading}
              />
            </div>
          </div>

          {/* Chat input or Expired State */}
          <div className="border-t border-[--gray-3]" />
          <div className="flex-none p-4 min-h-44 drop-shadow-md">
            {isExpired ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-[--gray-11] text-sm font-medium">
                  Your browser session has expired
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-[--gray-1] rounded-full border-[--gray-3] text-[--gray-11] h-8"
                  onClick={handleNewChat}
                >
                  <Plus className="h-4 w-4" />
                  <span className="px-1 font-geist">New Chat</span>
                </Button>
              </div>
            ) : (
              <ChatInput
                value={input}
                onChange={(value: string) =>
                  handleInputChange({ target: { value } } as any)
                }
                onSubmit={handleSend}
                disabled={isLoading}
                isLoading={isLoading}
                onStop={handleStop}
              />
            )}
          </div>
        </div>

        {/* Right (browser) - Flex grow to fill space */}
        <div
          className="
          flex-1 
          h-[40vh] md:h-full
          border-b md:border-b-0 border-[--gray-3] 
          p-4
        "
        >
          <Browser />
        </div>
      </div>

      {/* Modal for expanded image */}
      <Dialog
        open={selectedImage !== null}
        onOpenChange={(open) => !open && setSelectedImage(null)}
      >
        <DialogContent className="max-w-[90vw] p-0 border bg-[--gray-1] border-[#282828]">
          <div className="px-4 py-2 border-b border-[#282828] flex justify-between items-center">
            <DialogTitle className="text-[--gray-12] text-base font-medium">
              Page preview sent to model
            </DialogTitle>
            <button
              onClick={() => setSelectedImage(null)}
              className="text-[--gray-11] hover:text-[--gray-12] transition-colors"
            >
              Close
            </button>
          </div>
          {selectedImage && (
            <div
              className="p flex items-center justify-center"
              style={{ height: "80vh" }}
            >
              <img
                src={selectedImage}
                alt="Preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
