"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthModal } from "@/components/ui/AuthModal";
import { ChatInput } from "@/components/ui/ChatInput";

import { useToast } from "@/hooks/use-toast";

import { isLocalhost } from "@/lib/utils";

import Clouds from "@/public/clouds.png";

import { useChatContext } from "./contexts/ChatContext";
import { useSettings } from "./contexts/SettingsContext";
import { useSteelContext } from "./contexts/SteelContext";

export default function Home() {
  const router = useRouter();
  const { resetSession } = useSteelContext();
  const { setInitialMessage, clearInitialState } = useChatContext();
  const { currentSettings, updateSettings } = useSettings();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  // Store the pending query when waiting for API key
  const pendingQueryRef = useRef<string>("");

  // Clear all state on mount
  useEffect(() => {
    clearInitialState();
    resetSession();

    // Focus input after cleanup
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => clearTimeout(focusTimer);
  }, []); // Empty deps array means this runs once on mount

  const checkApiKey = () => {
    // const provider = currentSettings?.selectedProvider;
    // if (!provider) return false;
    // return !!currentSettings?.providerApiKeys?.[provider];

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
    const provider = currentSettings?.selectedProvider;
    if (!provider) return;
    // Update settings with new API key
    const currentKeys = currentSettings?.providerApiKeys || {};
    updateSettings({
      ...currentSettings!,
      providerApiKeys: {
        ...currentKeys,
        [provider]: key,
      },
    });
    setShowApiKeyModal(false);
    // Process the pending query
    if (pendingQueryRef.current) {
      proceedToChat(pendingQueryRef.current);
    }
  };
  const proceedToChat = (queryText: string) => {
    setInitialMessage(queryText);
    router.push(`/chat`);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    try {
      setLoading(true);
      resetSession();
      // Check if we have the API key or if Ollama is selected locally
      if (!checkApiKey()) {
        if (currentSettings?.selectedProvider === "ollama" && !isLocalhost()) {
          toast({
            title: "Cannot use Ollama",
            className:
              "text-[var(--gray-12)] border border-[var(--red-11)] bg-[var(--red-2)] text-sm",
            description:
              "Please select a different model provider or run the app locally to use Ollama.",
          });
        } else {
          pendingQueryRef.current = query;
          setShowApiKeyModal(true);
        }
        return;
      }
      proceedToChat(query);
    } catch (err) {
      console.error("Error creating session:", err);
      alert("Failed to create session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen flex-col items-center justify-center">
      <div className="flex w-full flex-col gap-6 px-4 md:max-w-[740px]">
        <div className="p-4 text-justify font-geist text-base font-medium leading-tight text-[--gray-12]">
          Surf.new® is a a playground to test out different web agents. These agents can surf the
          web and interact with webpages similar to how a human would. Built by{" "}
          <Link href="https://steel.dev" className="text-[--yellow-11]">
            <Image
              src="/steel_logo.svg"
              alt="Steel logo"
              width={18}
              height={18}
              className="mr-1 inline-block"
            />
            steel.dev
          </Link>
          .
        </div>
        <div className="flex w-full flex-col gap-2 px-4 md:max-w-[740px]">
          <div className="flex-col items-start justify-start">
            <div className="h-24 self-stretch overflow-hidden rounded-t-[20px] border border-[--gray-3]">
              <div className="relative h-32 px-6 pb-2 pt-8">
                <Image
                  src={Clouds}
                  alt="Decorative clouds background"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            <div className="self-stretch rounded-b-[20px] border border-t-0 border-[--gray-3] bg-[--gray-1] p-4">
              <ChatInput
                ref={inputRef}
                value={query}
                onChange={value => setQuery(value)}
                onSubmit={handleSubmit}
                disabled={loading}
                placeholder="What is on your mind?"
              />
            </div>
          </div>
          {/* Starter Buttons */}
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="#"
              onClick={e => {
                e.preventDefault();
                const text =
                  "Find me the cheapest one-way flight from San Francisco to Tokyo next week.";
                if (!loading) {
                  resetSession();
                  if (!checkApiKey()) {
                    if (currentSettings?.selectedProvider === "ollama" && !isLocalhost()) {
                      toast({
                        title: "Cannot use Ollama",
                        className:
                          "text-[var(--gray-12)] border border-[var(--red-11)] bg-[var(--red-2)] text-sm",
                        description:
                          "Please select a different model provider or run the app locally to use Ollama.",
                      });
                    } else {
                      pendingQueryRef.current = text;
                      setShowApiKeyModal(true);
                    }
                    return;
                  }
                  proceedToChat(text);
                }
              }}
              className="rounded-[20px] border border-[--gray-3] bg-[--gray-1] p-4 transition-colors hover:bg-[--gray-2]"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-8 items-center justify-center rounded-full bg-[--gray-5]">
                    <Image
                      src="/icons/pixel_plane.svg"
                      alt="Plane icon"
                      width={16}
                      height={16}
                      className="text-[--blue-9]"
                    />
                  </div>
                  <div className="text-sm font-medium text-[--gray-12]">Scrape & Compare</div>
                </div>
                <div className="text-sm font-medium leading-tight text-[--gray-11]">
                  Find me the cheapest one-way flight from San Francisco to Tokyo next week.
                </div>
              </div>
            </Link>

            <Link
              href="#"
              onClick={e => {
                e.preventDefault();
                const text =
                  "Go to Hacker News and summarize the top 5 stories for me. Format your response in markdown.";
                if (!loading) {
                  resetSession();
                  if (!checkApiKey()) {
                    if (currentSettings?.selectedProvider === "ollama" && !isLocalhost()) {
                      toast({
                        title: "Cannot use Ollama",
                        className:
                          "text-[var(--gray-12)] border border-[var(--red-11)] bg-[var(--red-2)] text-sm",
                        description:
                          "Please select a different model provider or run the app locally to use Ollama.",
                      });
                    } else {
                      pendingQueryRef.current = text;
                      setShowApiKeyModal(true);
                    }
                    return;
                  }
                  proceedToChat(text);
                }
              }}
              className="rounded-[20px] border border-[--gray-3] bg-[--gray-1] p-4 transition-colors hover:bg-[--gray-2]"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-8 items-center justify-center rounded-full bg-[--gray-5]">
                    <Image
                      src="/icons/pixel_square.svg"
                      alt="Square icon"
                      width={16}
                      height={16}
                      className="text-[--yellow-9]"
                    />
                  </div>
                  <div className="text-sm font-medium text-[--gray-12]">Collect a List</div>
                </div>
                <div className="text-sm font-medium leading-tight text-[--gray-11]">
                  Go to Hacker News and summarize the top 5 stories for me.
                </div>
              </div>
            </Link>

            <Link
              href="#"
              onClick={e => {
                e.preventDefault();
                const text = "Investigate the trade-in value for iPhone 13 Pro Max on apple.com";
                if (!loading) {
                  resetSession();
                  if (!checkApiKey()) {
                    if (currentSettings?.selectedProvider === "ollama" && !isLocalhost()) {
                      toast({
                        title: "Cannot use Ollama",
                        className:
                          "text-[var(--gray-12)] border border-[var(--red-11)] bg-[var(--red-2)] text-sm",
                        description:
                          "Please select a different model provider or run the app locally to use Ollama.",
                      });
                    } else {
                      pendingQueryRef.current = text;
                      setShowApiKeyModal(true);
                    }
                    return;
                  }
                  proceedToChat(text);
                }
              }}
              className="rounded-[20px] border border-[--gray-3] bg-[--gray-1] p-4 transition-colors hover:bg-[--gray-2]"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-8 items-center justify-center rounded-full bg-[--gray-5]">
                    <Image
                      src="/icons/pixel_dollar.svg"
                      alt="Dollar icon"
                      width={16}
                      height={16}
                      className="text-[--blue-9]"
                    />
                  </div>
                  <div className="text-sm font-medium text-[--gray-12]">Investigate for me</div>
                </div>
                <div className="text-sm font-medium leading-tight text-[--gray-11]">
                  Investigate the trade-in value for iPhone 13 Pro Max on apple.com
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
      {/* Add API Key Modal */}
      <AuthModal
        provider={currentSettings?.selectedProvider || ""}
        isOpen={showApiKeyModal}
        onSubmit={handleApiKeySubmit}
      />
    </main>
  );
}
