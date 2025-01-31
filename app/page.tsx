"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useChatContext } from "./contexts/ChatContext";
import { ChatInput } from "@/components/ui/ChatInput";
import { AuthModal } from "@/components/ui/AuthModal";
import Link from "next/link";
import { SearchIcon, ListIcon, Search } from "lucide-react";
import { useSettings } from "./contexts/SettingsContext";
import { useSteelContext } from "./contexts/SteelContext";
import { cn } from "@/lib/utils";

export default function Home() {
  const router = useRouter();
  const { resetSession } = useSteelContext();
  const { setInitialMessage, clearInitialState } = useChatContext();
  const { currentSettings, updateSettings } = useSettings();
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
    const provider = currentSettings?.selectedProvider;
    if (!provider) return false;
    return !!currentSettings?.providerApiKeys?.[provider];
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
      // Check if we have the API key
      if (!checkApiKey()) {
        pendingQueryRef.current = query;
        setShowApiKeyModal(true);
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
    <main className="flex flex-col items-center justify-center h-screen">
      <div className="w-full md:max-w-[740px] px-4 flex flex-col gap-6">
        <div className="text-justify p-4 text-[--gray-12] text-base font-medium font-geist leading-tight">
          Surf.new® is a a playground to test out different web agents. These
          agents can surf the web and interact with webpages similar to how a
          human would.
        </div>
        <div className="w-full md:max-w-[740px] px-4 flex flex-col gap-2">
          <div className="flex-col justify-start items-start">
            <div className="self-stretch h-24 rounded-t-[20px] border border-[--gray-3] overflow-hidden">
              <div className="relative h-32 px-6 pt-8 pb-2">
                <Image
                  src="/img_clouds.png"
                  alt="Decorative clouds background"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            <div className="self-stretch px-6 pt-6 pb-3 bg-[--gray-1] rounded-b-[20px] border border-[--gray-3] border-t-0">
              <ChatInput
                ref={inputRef}
                value={query}
                onChange={(value) => setQuery(value)}
                onSubmit={handleSubmit}
                disabled={loading}
                placeholder="What is on your mind?"
              />
            </div>
          </div>
          {/* Starter Buttons */}
          <div className="flex flex-col gap-2 mt-4">
            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault();
                const text =
                  "Find me the cheapest flight from San Francisco to Tokyo during the second week of February.";
                if (!loading) {
                  resetSession();
                  if (!checkApiKey()) {
                    pendingQueryRef.current = text;
                    setShowApiKeyModal(true);
                    return;
                  }
                  proceedToChat(text);
                }
              }}
              className="w-full p-4 bg-[--gray-1] rounded-[20px] border border-[--gray-3] hover:bg-[--gray-2] transition-colors"
            >
              <div className="flex items-start gap-2">
                <div className="w-8 h-6 bg-[--gray-5] rounded-full flex items-center justify-center">
                  <SearchIcon className="w-4 h-4 text-[--blue-9]" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-[--gray-12] text-sm font-medium">
                    Scrape & Compare
                  </div>
                  <div className="text-[--gray-11] text-sm font-medium leading-tight">
                    Find me the cheapest flight from San Francisco to Tokyo the
                    2nd week of February.
                  </div>
                </div>
              </div>
            </Link>

            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault();
                const text =
                  "Go to Hacker News and summarize the top 5 stories for me. Format your response in markdown.";
                if (!loading) {
                  resetSession();
                  if (!checkApiKey()) {
                    pendingQueryRef.current = text;
                    setShowApiKeyModal(true);
                    return;
                  }
                  proceedToChat(text);
                }
              }}
              className="w-full p-4 bg-[--gray-1] rounded-[20px] border border-[--gray-3] hover:bg-[--gray-2] transition-colors"
            >
              <div className="flex items-start gap-2">
                <div className="w-8 h-6 bg-[--gray-5] rounded-full flex items-center justify-center">
                  <ListIcon className="w-4 h-4 text-[--blue-9]" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-[--gray-12] text-sm font-medium">
                    Collect a List
                  </div>
                  <div className="text-[--gray-11] text-sm font-medium leading-tight">
                    Go to Hacker News and summarize the top 5 stories for me.
                  </div>
                </div>
              </div>
            </Link>

            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault();
                const text =
                  "Investigate the trade-in value for iPhone 13 Pro Max on apple.com";
                if (!loading) {
                  resetSession();
                  if (!checkApiKey()) {
                    pendingQueryRef.current = text;
                    setShowApiKeyModal(true);
                    return;
                  }
                  proceedToChat(text);
                }
              }}
              className="w-full p-4 bg-[--gray-1] rounded-[20px] border border-[--gray-3] hover:bg-[--gray-2] transition-colors"
            >
              <div className="flex items-start gap-2">
                <div className="w-8 h-6 bg-[--gray-5] rounded-full flex items-center justify-center">
                  <Search className="w-4 h-4 text-[--blue-9]" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-[--gray-12] text-sm font-medium">
                    Investigate for me
                  </div>
                  <div className="text-[--gray-11] text-sm font-medium leading-tight">
                    Investigate the trade-in value for iPhone 13 Pro Max on apple.com
                  </div>
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
