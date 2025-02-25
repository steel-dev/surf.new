'use client';

import { useChat } from 'ai/react';
import { useSettings } from '@/app/contexts/SettingsContext';
import { useSteelContext } from '@/app/contexts/SteelContext';
import { ChatInput } from '@/components/ui/ChatInput';
import { useEffect, useState, useRef } from 'react';
import { useChatContext } from '@/app/contexts/ChatContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CheckIcon } from '@radix-ui/react-icons';
import { ToolInvocations } from '@/components/ui/tool';
import { useInView } from 'react-intersection-observer';
import { Browser } from '@/components/ui/Browser';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AuthModal } from '@/components/ui/AuthModal';
import { AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  atomDark,
  solarizedDarkAtom,
} from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownTextProps {
  content: string;
}

// UPDATED CodeBlock component for rendering code blocks with a copy button and language display.
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  if (language) {
    return (
      <div className="my-4  rounded overflow-hidden">
        {/* Header bar displaying the language (if provided) and the copy button */}
        <div className="flex items-center justify-between bg-[--gray-1] text-[--gray-12] text-xs px-3 py-1">
          <span>{language.toUpperCase()}</span>
          <button
            onClick={handleCopy}
            className="bg-[--gray-1] text-xs px-2 py-1 rounded border border-[--gray-3] hover:bg-[--gray-2] transition-colors"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <SyntaxHighlighter
          language={language}
          style={atomDark}
          customStyle={{ padding: '1rem', margin: 0, borderRadius: '0.5rem' }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }

  // Fallback if no language is provided: show the copy button as an overlay.
  return (
    <div className="relative my-4 group">
      <SyntaxHighlighter
        language="text"
        style={atomDark}
        customStyle={{ padding: '1rem', borderRadius: '0.5rem' }}
      >
        {code}
      </SyntaxHighlighter>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 hidden group-hover:block bg-gray-700 text-xs text-white px-2 py-1 rounded"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

// UPDATED MarkdownText component to support code blocks along with inline markdown
function MarkdownText({ content }: { content: string }) {
  // Helper function to process inline markdown (links, bold, italics)
  const parseInlineMarkdown = (text: string, keyOffset: number) => {
    const segments = text
      .split(/(\[.*?\]\(.*?\))|(\*.*?\*)|(_.*?_)/g)
      .filter(Boolean);
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
      const language = match[1] || '';
      const codeContent = match[2];
      elements.push(
        <CodeBlock key={`code-${key}`} language={language} code={codeContent} />
      );
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

  return <>{parseContent(content)}</>;
}

interface UserMessageProps {
  content: string;
}

function UserMessage({ content }: UserMessageProps) {
  const hasLineBreaks = content.includes('\n');
  const longestLine = Math.max(
    ...content.split('\n').map((line) => line.length)
  );
  const isLongMessage = longestLine > 60;

  return (
    <div className="flex justify-end w-full">
      <div
        className={`
          inline-flex p-3 max-w-[85%] w-fit font-geist
          ${
            isLongMessage || hasLineBreaks ? 'rounded-3xl' : 'rounded-full px-4'
          }
          bg-[--blue-9] shrink-0
        `}
      >
        <div
          className={`
            text-[--gray-12] text-base font-normal 
            font-geist leading-normal whitespace-pre-wrap
            break-words w-full overflow-hidden
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
  console.info('🔄 Initializing ChatPage component');
  const { currentSettings, updateSettings } = useSettings();
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
  const { toast } = useToast();

  // Add API key modal state and handlers
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const pendingMessageRef = useRef<string>('');

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
    console.info('🔑 Handling API key submission');
    const provider = currentSettings?.selectedProvider;
    if (!provider) return;

    console.info(
      '⚙️ Updating settings with new API key for provider:',
      provider
    );
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
      console.info(
        '📝 Setting initial message from pending ref:',
        pendingMessageRef.current
      );
      setInitialMessage(pendingMessageRef.current);
      pendingMessageRef.current = '';
    }
  };

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
    api: '/api/chat',
    id: currentSession?.id || undefined,
    maxSteps: 10,
    initialMessages: initialMessage
      ? [{ id: '1', role: 'user', content: initialMessage }]
      : undefined,
    body: {
      session_id: currentSession?.id,
      agent_type: currentSettings?.selectedAgent,
      provider: currentSettings?.selectedProvider,
      api_key:
        currentSettings?.providerApiKeys?.[
          currentSettings?.selectedProvider || ''
        ] || '',
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
            typeof value === 'string' ? value : Number(value),
          ])
      ),
    },
    onFinish: (message) => {
      console.info('✅ Chat finished:', message);
    },
    onError: (error) => {
      console.error('❌ Chat error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'An unexpected error occurred',
        className:
          'text-[var(--gray-12)] border border-[var(--red-11)] bg-[var(--red-2)] text-sm',
      });
    },
    onToolCall: (toolCall) => {
      console.info('🛠️ Tool call received:', toolCall);
    },
  });

  // Track whether user is at the bottom
  const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    if (!scrollAreaRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } =
      scrollAreaRef.current.children[0];
    const atBottom = scrollHeight - clientHeight <= scrollTop + 1;

    if (atBottom !== isAtBottom) {
      console.info('📜 Scroll position changed:', { atBottom });
      setIsAtBottom(atBottom);
    }
  }

  // If user is sending a message (isLoading = true), scroll to bottom
  useEffect(() => {
    console.info('📜 Loading state changed:', { isLoading });
    if (isLoading) {
      if (!scrollAreaRef.current?.children[0]) {
        console.warn('⚠️ Messages container is null; cannot scroll');
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

  // Log key context and state changes
  useEffect(() => {
    console.info('📊 Current session state:', {
      sessionId: currentSession?.id,
      isCreating: isCreatingSession,
      isExpired,
      hasShownConnection,
      isSubmitting,
    });
  }, [
    currentSession?.id,
    isCreatingSession,
    isExpired,
    hasShownConnection,
    isSubmitting,
  ]);

  useEffect(() => {
    console.info('⚙️ Current settings state:', {
      provider: currentSettings?.selectedProvider,
      model: currentSettings?.selectedModel,
      agent: currentSettings?.selectedAgent,
      hasApiKey:
        !!currentSettings?.providerApiKeys?.[
          currentSettings?.selectedProvider || ''
        ],
    });
  }, [currentSettings]);

  // Track message state changes
  useEffect(() => {
    if (messages.length > 0) {
      console.info('💬 Messages state updated:', {
        count: messages.length,
        lastMessage: {
          role: messages[messages.length - 1].role,
          hasContent: !!messages[messages.length - 1].content,
          hasToolCalls: !!messages[messages.length - 1].toolInvocations?.length,
        },
        allMessages: messages.map((m) => ({
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
    console.info('🔄 Chat interaction state:', {
      isLoading,
      isSubmitting,
      hasInput: !!input,
      messagesCount: messages.length,
    });
  }, [isLoading, isSubmitting, input, messages.length]);

  // Enhanced handleSend with more logging
  async function handleSend(
    e: React.FormEvent,
    messageText: string,
    attachments: File[]
  ) {
    console.info('📤 Handling message send:', {
      messageText,
      attachments,
      currentState: {
        hasSession: !!currentSession?.id,
        messagesCount: messages.length,
        isFirstMessage: messages.length === 0,
        isSubmitting,
        hasApiKey: checkApiKey(),
      },
    });

    e.preventDefault();

    if (!checkApiKey()) {
      console.info('🔑 No API key found, storing message and showing modal');
      pendingMessageRef.current = messageText;
      setShowApiKeyModal(true);
      return;
    }

    setIsSubmitting(true);
    if (messages.length === 0) {
      console.info('📝 Setting initial message with context:', {
        messageText,
        sessionId: currentSession?.id,
        provider: currentSettings?.selectedProvider,
        agent: currentSettings?.selectedAgent,
      });
      setInitialMessage(messageText);
      handleInputChange({ target: { value: '' } } as any);
    } else {
      console.info('📤 Submitting message to existing chat:', {
        messageText,
        sessionId: currentSession?.id,
        existingMessages: messages.length,
      });
      handleSubmit(e);
      return;
    }

    let session = currentSession;
    if (!session?.id) {
      console.info('🔄 Creating new session for message');
      session = await createSession();
      console.info('✅ New session created:', session);
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
    console.info('🧹 Starting cleanup of incomplete tool calls');
    console.info(
      '📊 Current messages state:',
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        toolCalls: m.toolInvocations?.map((t) => ({
          state: t.state,
        })),
      }))
    );

    setMessages((prev) => {
      const updatedMessages = prev
        .map((msg) => {
          if (msg.role === 'assistant' && Array.isArray(msg.toolInvocations)) {
            const filteredToolInvocations = msg.toolInvocations.filter(
              (invocation) => invocation.state === 'result'
            );
            console.info('🔍 Processing message tool calls:', {
              messageId: msg.id,
              before: msg.toolInvocations.length,
              after: filteredToolInvocations.length,
              removed:
                msg.toolInvocations.length - filteredToolInvocations.length,
              removedStates: msg.toolInvocations
                .filter((t) => t.state !== 'result')
                .map((t) => ({ state: t.state })),
            });
            return {
              ...msg,
              toolInvocations: filteredToolInvocations,
            };
          }
          return msg;
        })
        .filter((msg) => {
          if (
            msg.role === 'assistant' &&
            !msg.content?.trim() &&
            (!msg.toolInvocations || msg.toolInvocations.length === 0)
          ) {
            console.info('🗑️ Removing empty assistant message');
            return false;
          }
          return true;
        });

      console.info('✅ Cleanup complete:', {
        beforeCount: prev.length,
        afterCount: updatedMessages.length,
        removedCount: prev.length - updatedMessages.length,
      });

      return updatedMessages;
    });
  }

  function handleStop() {
    console.info('🛑 Stopping chat');
    stop();
    removeIncompleteToolCalls();
  }

  // Helper function to check if a value is a setting config object
  function isSettingConfig(value: any): boolean {
    return (
      value &&
      typeof value === 'object' &&
      'type' in value &&
      'default' in value
    );
  }

  // Reuse the same handler from NavBar for consistency
  const handleNewChat = async () => {
    console.info('🆕 Starting new chat');
    router.push('/');
  };

  // Add effect to handle session expiration
  useEffect(() => {
    console.info('⏰ Session expiration status changed:', { isExpired });
    if (isExpired) {
      console.info('⚠️ Session expired, cleaning up');
      stop();
      removeIncompleteToolCalls();
    }
  }, [isExpired]);

  return (
    <>
      <div className="flex flex-col-reverse md:flex-row h-[calc(100vh-3.5rem)]">
        {/* Left (chat) - Set min/max width for desktop, full width on mobile */}
        <div
          className="
          flex flex-col 
          w-full md:w-[400px] md:min-w-[480px] md:max-w-[480px]
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
                    {message.role === 'user' ? (
                      <>
                        <UserMessage content={message.content} />
                        {index === 0 && isCreatingSession && (
                          <div className="px-4 py-2 bg-[--blue-2] text-[--blue-11] font-geist border border-[--blue-3] rounded-md text-sm animate-pulse w-[85%] mx-auto mt-2">
                            Connecting to Steel Browser Session...
                          </div>
                        )}
                        {index === 0 &&
                          hasShownConnection &&
                          !isCreatingSession &&
                          currentSession?.id && (
                            <div className="px-4 py-2 bg-[--green-2] text-[--green-11] font-geist border border-[--green-3] rounded-md text-sm flex items-center gap-2 w-[85%] mx-auto mt-2">
                              <CheckIcon className="h-4 w-4" />
                              Steel Browser Session connected
                            </div>
                          )}
                      </>
                    ) : (
                      <div className="flex flex-col gap-2 text-base text-[--gray-12] w-full max-w-full break-words">
                        {message.content && (
                          <div className="w-full max-w-full break-words whitespace-pre-wrap">
                            <MarkdownText content={message.content} />
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
                      <span className="text-[--gray-11] text-sm font-normal font-geist leading-[18px]">
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
              style={{ height: '80vh' }}
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

      {/* API Key Modal */}
      <AuthModal
        provider={currentSettings?.selectedProvider || ''}
        isOpen={showApiKeyModal}
        onSubmit={handleApiKeySubmit}
      />
    </>
  );
}
