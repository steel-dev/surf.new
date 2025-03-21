"use client";

import React, { useEffect, useRef, useState } from "react";
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
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

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
}

// UPDATED MarkdownText component to support code blocks along with inline markdown
function MarkdownText({ content }: { content: string }) {
  // Helper function to process inline markdown (links, bold, italics)
  const parseInlineMarkdown = (text: string, keyOffset: number) => {
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
  };

  // Main parser that first detects code blocks and falls back to inline markdown
  const parseContent = (text: string) => {
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
  };

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
            <div className="mb-1 text-sm font-medium text-[--gray-12]">{title}</div>
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
}

interface UserMessageProps {
  content: string;
}

function UserMessage({ content }: UserMessageProps) {
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

function ChatScrollAnchor({ trackVisibility, isAtBottom, scrollAreaRef }: ChatScrollAnchorProps) {
  const { ref, inView } = useInView({
    trackVisibility,
    delay: 100,
  });

  useEffect(() => {
    if (isAtBottom && trackVisibility && !inView && scrollAreaRef.current?.children[0]) {
      const messagesContainer = scrollAreaRef.current.children[0];
      messagesContainer.scrollTop = messagesContainer.scrollHeight - messagesContainer.clientHeight;
    }
  }, [inView, isAtBottom, trackVisibility]);

  return <div ref={ref} className="h-px w-full" />;
}

export default function ChatPage() {
  console.info("🔄 Initializing ChatPage component");
  const { currentSettings, updateSettings } = useSettings();
  const { currentSession, createSession, isCreatingSession, isExpired } = useSteelContext();
  const { initialMessage, setInitialMessage } = useChatContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasShownConnection, setHasShownConnection] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Add API key modal state and handlers
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const pendingMessageRef = useRef<string>("");

  const checkApiKey = () => {
    // // For Ollama, we don't need an API key as it connects to a local instance
    // if (currentSettings?.selectedProvider === 'ollama') {
    //   return true;
    // }

    // // For other providers, check if API key exists
    // const provider = currentSettings?.selectedProvider;
    // if (!provider) return false;
    // const hasKey = !!currentSettings?.providerApiKeys?.[provider];
    // return hasKey;
    return true;
  };

  const handleApiKeySubmit = (key: string) => {
    console.info("🔑 Handling API key submission");
    const provider = currentSettings?.selectedProvider;
    if (!provider) return;

    console.info("⚙️ Updating settings with new API key for provider:", provider);
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
      console.info("📝 Setting initial message from pending ref:", pendingMessageRef.current);
      setInitialMessage(pendingMessageRef.current);
      pendingMessageRef.current = "";
    }
  };

  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string>("");

  const handleResume = async () => {
    if (!currentSession?.id) {
      return;
    }

    try {
      setIsPaused(false);
      setPauseReason("");

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

        setIsPaused(true);
        setPauseReason("Failed to resume. Try again.");
        throw new Error("Failed to resume execution");
      }

      toast({
        title: "Resumed",
        description: "Execution resumed",
        className: "border border-[--green-6] bg-[--green-3] text-[--green-11]",
      });
    } catch (error) {
      console.error("❌ Error resuming execution:", error);
      toast({
        title: "Error",
        description: "Failed to resume execution",
        className: "border border-[--red-6] bg-[--red-3] text-[--red-11]",
      });
    }
  };

  const { messages, handleSubmit, isLoading, input, handleInputChange, setMessages, reload, stop } =
    useChat({
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
      },
      onFinish: message => {
        console.info("✅ Chat finished:", message);
      },
      onError: error => {
        console.error("❌ Chat error:", error);
        toast({
          title: "Error",
          description: error?.message || "An unexpected error occurred",
          className:
            "text-[var(--gray-12)] border border-[var(--red-11)] bg-[var(--red-2)] text-sm",
        });
      },
      onToolCall: toolCall => {
        console.info("🛠️ Tool call received:", toolCall);
      },
    });

  // Watch for pause messages and tool calls
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.info("🔍 Checking message for pause:", {
        content: lastMessage.content,
        role: lastMessage.role,
        toolInvocations: lastMessage.toolInvocations,
        isPausedState: isPaused,
        currentReason: pauseReason,
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
            pauseReasonText = pauseToolCall.args.reason || "Unknown reason";
            console.info("⏸️ Found pause tool call:", {
              toolCall: pauseToolCall,
              extractedReason: pauseReasonText,
            });
          }
        }
        // Also check for pause message in content
        else if (lastMessage.content && lastMessage.content.includes("⏸️ Pausing execution")) {
          foundPause = true;
          const parts = lastMessage.content.split("⏸️ Pausing execution: ");
          pauseReasonText = parts[1]?.trim() || "Unknown reason";
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

          console.info(
            "🔍 Current pause messages:",
            messages.filter(
              m =>
                m.content?.includes("⏸️ Pausing execution") ||
                m.toolInvocations?.some(tool => tool.toolName === "pause_execution")
            ).length
          );

          // Don't add an extra message - use the existing tool call message instead
          console.info("⏸️ Using existing pause message from tool call");
        }
      }
    }
  }, [messages]);

  // Track whether user is at the bottom
  const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    if (!scrollAreaRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current.children[0];
    const atBottom = scrollHeight - clientHeight <= scrollTop + 1;

    if (atBottom !== isAtBottom) {
      console.info("📜 Scroll position changed:", { atBottom });
      setIsAtBottom(atBottom);
    }
  }

  // If user is sending a message (isLoading = true), scroll to bottom
  useEffect(() => {
    console.info("📜 Loading state changed:", { isLoading });
    if (isLoading) {
      if (!scrollAreaRef.current?.children[0]) {
        console.warn("⚠️ Messages container is null; cannot scroll");
        return;
      }
      const messagesContainer = scrollAreaRef.current.children[0];
      messagesContainer.scrollTop = messagesContainer.scrollHeight - messagesContainer.clientHeight;
      setIsAtBottom(true);
    }
  }, [isLoading]);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImageClick = (imageSrc: string) => {
    setSelectedImage(imageSrc);
  };

  // Log key context and state changes
  useEffect(() => {
    console.info("📊 Current session state:", {
      sessionId: currentSession?.id,
      isCreating: isCreatingSession,
      isExpired,
      hasShownConnection,
      isSubmitting,
    });
  }, [currentSession?.id, isCreatingSession, isExpired, hasShownConnection, isSubmitting]);

  useEffect(() => {
    console.info("⚙️ Current settings state:", {
      provider: currentSettings?.selectedProvider,
      model: currentSettings?.selectedModel,
      agent: currentSettings?.selectedAgent,
      hasApiKey: !!currentSettings?.providerApiKeys?.[currentSettings?.selectedProvider || ""],
    });
  }, [currentSettings]);

  // Track message state changes with enhanced logging
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.info("📥 New message received:", {
        id: lastMessage.id,
        role: lastMessage.role,
        content: lastMessage.content,
        hasToolInvocations: !!lastMessage.toolInvocations,
        toolInvocationsCount: lastMessage.toolInvocations?.length || 0,
        toolInvocations: lastMessage.toolInvocations?.map(t => ({
          name: t.toolName,
          args: t.args,
          state: t.state,
          hasResult: !!t.args,
        })),
        totalMessages: messages.length,
        messageHistory: messages.map(m => ({
          id: m.id,
          role: m.role,
          hasContent: !!m.content,
          toolCallsCount: m.toolInvocations?.length || 0,
        })),
      });
    }
  }, [messages]);

  // Track loading and submission states
  useEffect(() => {
    console.info("🔄 Chat interaction state:", {
      isLoading,
      isSubmitting,
      hasInput: !!input,
      messagesCount: messages.length,
    });
  }, [isLoading, isSubmitting, input, messages.length]);

  // Add pause state monitoring
  useEffect(() => {
    console.info("🎯 Pause state changed:", {
      isPaused,
      pauseReason,
      isExpired,
      isLoading,
      hasInput: !!input,
      messagesCount: messages.length,
    });
  }, [isPaused, pauseReason, isExpired, isLoading, input, messages.length]);

  // Add a dedicated effect to track isPaused state changes
  useEffect(() => {
    console.info("🔄 isPaused state changed in ChatPage:", {
      isPaused,
      pauseReason,
      messagesCount: messages.length,
    });
  }, [isPaused, pauseReason, messages.length]);

  // Add effect to handle browser control events
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
          content:
            "⏸️ You have taken control of the browser. Type a message when you're ready to continue.",
        },
      ]);
    };

    // Add event listener for browser pause events
    window.addEventListener("browser-paused", handleBrowserPaused as EventListener);

    return () => {
      window.removeEventListener("browser-paused", handleBrowserPaused as EventListener);
    };
  }, [isLoading]);

  // Enhanced handleSend with more logging
  async function handleSend(e: React.FormEvent, messageText: string, attachments: File[]) {
    console.info("📤 Handling message send:", {
      messageText,
      attachments,
      currentState: {
        hasSession: !!currentSession?.id,
        messagesCount: messages.length,
        isFirstMessage: messages.length === 0,
        isSubmitting,
        hasApiKey: checkApiKey(),
        isPaused,
      },
    });

    e.preventDefault();

    if (!checkApiKey()) {
      console.info("🔑 No API key found, storing message and showing modal");
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
        sessionId: currentSession?.id,
        provider: currentSettings?.selectedProvider,
        agent: currentSettings?.selectedAgent,
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

  // Enhanced removeIncompleteToolCalls with more detailed logging
  function removeIncompleteToolCalls() {
    console.info("🧹 Starting cleanup of incomplete tool calls");
    console.info(
      "📊 Current messages state:",
      messages.map(m => ({
        id: m.id,
        role: m.role,
        toolCalls: m.toolInvocations?.map(t => ({
          state: t.state,
        })),
      }))
    );

    setMessages(prev => {
      const updatedMessages = prev
        .map(msg => {
          if (msg.role === "assistant" && Array.isArray(msg.toolInvocations)) {
            const filteredToolInvocations = msg.toolInvocations.filter(
              invocation => invocation.state === "result"
            );
            console.info("🔍 Processing message tool calls:", {
              messageId: msg.id,
              before: msg.toolInvocations.length,
              after: filteredToolInvocations.length,
              removed: msg.toolInvocations.length - filteredToolInvocations.length,
              removedStates: msg.toolInvocations
                .filter(t => t.state !== "result")
                .map(t => ({ state: t.state })),
            });
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
            console.info("🗑️ Removing empty assistant message");
            return false;
          }
          return true;
        });

      console.info("✅ Cleanup complete:", {
        beforeCount: prev.length,
        afterCount: updatedMessages.length,
        removedCount: prev.length - updatedMessages.length,
      });

      return updatedMessages;
    });
  }

  function handleStop() {
    console.info("🛑 Stopping chat");
    stop();
    removeIncompleteToolCalls();
  }

  // Helper function to check if a value is a setting config object
  function isSettingConfig(value: any): boolean {
    return value && typeof value === "object" && "type" in value && "default" in value;
  }

  // Reuse the same handler from NavBar for consistency
  const handleNewChat = async () => {
    console.info("🆕 Starting new chat");
    router.push("/");
  };

  // Add effect to handle session expiration
  useEffect(() => {
    console.info("⏰ Session expiration status changed:", { isExpired });
    if (isExpired) {
      console.info("⚠️ Session expired, cleaning up");
      stop();
      removeIncompleteToolCalls();
    }
  }, [isExpired]);

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
              {messages.map((message, index) => {
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
                              <div className="mt-2 flex w-full max-w-full flex-col gap-2 rounded-[1.25rem] border border-[--gray-3] bg-[--gray-1] p-2">
                                <div className="flex items-center gap-2 rounded-2xl border border-[--green-3] bg-[--green-2] p-3 font-geist text-sm text-[--green-11]">
                                  <CheckIcon className="size-4" />
                                  Steel Browser Session connected
                                </div>
                              </div>
                            )}
                        </>
                      ) : (
                        <div className="flex w-full max-w-full flex-col gap-4 break-words text-base text-[--gray-12]">
                          {/* Check if this is a special message */}
                          {(() => {
                            const hasToolInvocations =
                              message.toolInvocations && message.toolInvocations.length > 0;

                            // Add detailed logging for each message rendering
                            console.info(`📱 Rendering assistant message ${message.id}:`, {
                              hasContent: !!message.content,
                              contentLength: message.content?.length || 0,
                              hasToolInvocations,
                              toolCount: message.toolInvocations?.length || 0,
                              toolNames: message.toolInvocations?.map(t => t.toolName) || [],
                              messageIndex: index,
                            });

                            // Check for memory or goal messages first
                            const isMemoryOrGoalMessage =
                              message.content &&
                              (message.content.includes("*Memory*:") ||
                                message.content.includes("*Next Goal*:") ||
                                message.content.includes("*Previous Goal*:"));

                            // Regular tool invocations (but not pause tools)
                            const isRegularToolMessage =
                              hasToolInvocations &&
                              !message.toolInvocations?.some(
                                tool => tool.toolName === "pause_execution"
                              );

                            // Check for special message (either memory/goal or regular tool, but not pause)
                            const isSpecial = isMemoryOrGoalMessage || isRegularToolMessage;

                            // Check for pause message specifically
                            const pauseToolCall = message.toolInvocations?.find(
                              tool => tool.toolName === "pause_execution"
                            );

                            // Check for pause message in content or tool calls
                            const isPauseToolCall = hasToolInvocations && !!pauseToolCall;
                            const isPauseContentMessage =
                              message.content?.includes("⏸️ Pausing execution");
                            const isPauseMessage = isPauseToolCall || isPauseContentMessage;

                            // Get the pause reason from either source
                            let pauseReason = "";

                            if (isPauseToolCall && pauseToolCall) {
                              // Clean up the reason - sometimes it includes the "⏸️" prefix which causes duplication
                              const rawReason = pauseToolCall.args?.reason || "Unknown reason";
                              pauseReason = rawReason.replace(/^⏸️\s*/, "");
                            } else if (isPauseContentMessage && message.content) {
                              const parts = message.content.split("⏸️ Pausing execution: ");
                              pauseReason = parts[1]?.trim() || "Unknown reason";
                            }

                            // Log the message classification for debugging
                            console.info(`🏷️ Message ${message.id} classification:`, {
                              isMemoryOrGoalMessage,
                              isRegularToolMessage,
                              isSpecial,
                              isPauseMessage,
                              isPauseToolCall,
                              isPauseContentMessage,
                              pauseReason,
                              messageId: message.id,
                            });

                            // This is a critical check - if it's a pause message, we need to render it
                            if (isPauseMessage) {
                              // If we've already rendered a different pause message with the same reason, skip this one
                              const previousPauseWithSameReason = messages
                                .slice(0, index)
                                .some(m => {
                                  // Check for tool call with same reason
                                  const prevToolCall = m.toolInvocations?.find(
                                    t => t.toolName === "pause_execution"
                                  );
                                  if (prevToolCall && prevToolCall.args?.reason === pauseReason) {
                                    return true;
                                  }

                                  // Check for content message with same reason
                                  if (m.content?.includes(`⏸️ Pausing execution: ${pauseReason}`)) {
                                    return true;
                                  }

                                  return false;
                                });

                              if (previousPauseWithSameReason) {
                                console.info(
                                  `⏸️ Skipping duplicate pause message for ${message.id}`
                                );
                                return null;
                              }

                              console.info(`⏸️ Rendering pause message UI for ${message.id}`, {
                                reason: pauseReason,
                                isPaused: isPaused,
                              });

                              return (
                                <div className="flex w-full max-w-full flex-col gap-4">
                                  <div className="flex flex-col gap-4">
                                    <div className="font-normal text-[--gray-12]">
                                      <MarkdownText content={pauseReason} />
                                    </div>
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
                                  </div>
                                </div>
                              );
                            }

                            // Find consecutive special messages (memory/goal or regular tool)
                            let specialMessagesGroup = [];
                            if (isSpecial) {
                              let i = index;
                              while (i < messages.length) {
                                const nextMessage = messages[i];
                                // Check if next message is a memory/goal message
                                const isNextMemoryOrGoal =
                                  nextMessage.content &&
                                  (nextMessage.content.includes("*Memory*:") ||
                                    nextMessage.content.includes("*Next Goal*:") ||
                                    nextMessage.content.includes("*Previous Goal*:"));

                                // Check if next message is a regular tool message
                                const hasNextToolInvocations =
                                  nextMessage.toolInvocations &&
                                  nextMessage.toolInvocations.length > 0;
                                const isNextRegularTool =
                                  hasNextToolInvocations &&
                                  !nextMessage.toolInvocations?.some(
                                    tool => tool.toolName === "pause_execution"
                                  );

                                // Group both types
                                const isNextSpecial = isNextMemoryOrGoal || isNextRegularTool;

                                if (!isNextSpecial) break;
                                specialMessagesGroup.push(nextMessage);
                                i++;
                              }
                            }

                            // Skip if this message is part of a group but not the first one
                            if (isSpecial && index > 0) {
                              const prevMessage = messages[index - 1];

                              // Check if previous message is a memory/goal message
                              const isPrevMemoryOrGoal =
                                prevMessage.content &&
                                (prevMessage.content.includes("*Memory*:") ||
                                  prevMessage.content.includes("*Next Goal*:") ||
                                  prevMessage.content.includes("*Previous Goal*:"));

                              // Check if previous message is a regular tool message
                              const hasPrevToolInvocations =
                                prevMessage.toolInvocations &&
                                prevMessage.toolInvocations.length > 0;
                              const isPrevRegularTool =
                                hasPrevToolInvocations &&
                                !prevMessage.toolInvocations?.some(
                                  tool => tool.toolName === "pause_execution"
                                );

                              // Both types can be part of a group
                              const isPrevSpecial = isPrevMemoryOrGoal || isPrevRegularTool;

                              if (isPrevSpecial) return null;
                            }

                            if (isSpecial) {
                              return (
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
                                              {groupMessage.toolInvocations.map(
                                                (tool, toolIndex) => (
                                                  <div
                                                    key={toolIndex}
                                                    className="flex w-full items-center justify-between rounded-2xl bg-[--gray-2] p-3"
                                                  >
                                                    <ToolInvocations
                                                      toolInvocations={[tool]}
                                                      onImageClick={handleImageClick}
                                                    />
                                                  </div>
                                                )
                                              )}
                                            </div>
                                          )}
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </div>
                              );
                            }

                            return message.content ? (
                              <div className="w-full max-w-full whitespace-pre-wrap break-words">
                                <MarkdownText content={message.content} />
                              </div>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                    {message.experimental_attachments?.map((attachment, idx) => (
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
              {isLoading && (
                <div className="size-4 animate-spin rounded-full border-2 border-[--gray-12] border-t-transparent" />
              )}

              {/* Simplified scroll anchor */}
              <ChatScrollAnchor
                scrollAreaRef={scrollAreaRef}
                isAtBottom={isAtBottom}
                trackVisibility={isLoading}
              />
            </div>
          </div>

          {/* Chat input or Expired/Paused State */}
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
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <ChatInput
                      value={input}
                      onChange={(value: string) => handleInputChange({ target: { value } } as any)}
                      onSubmit={handleSend}
                      disabled={isLoading}
                      isLoading={isLoading}
                      onStop={handleStop}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right (browser) - Keep more prominent */}
        <div
          className="
            h-[60vh] 
            flex-1 border-b
            border-[--gray-3] p-4 md:h-full 
            md:border-b-0
          "
        >
          {/* Use IIFE pattern to safely log without affecting rendering */}
          {(() => {
            console.info("👀 Rendering Browser component with isPaused:", isPaused);
            return null;
          })()}
          <Browser isPaused={isPaused} />
        </div>
      </div>

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
