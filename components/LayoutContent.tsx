"use client";

import { SteelProvider } from "../app/contexts/SteelContext";
import { SettingsProvider } from "@/app/contexts/SettingsContext";
import { ChatProvider } from "../app/contexts/ChatContext";
import { NavBar } from "@/components/ui/navbar";
import { Toaster } from "@/components/ui/toaster";
import { PostHogProvider } from "@/app/providers/PHProvider";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider>
      <ChatProvider>
        <SettingsProvider>
          <SteelProvider>
            <NavBar />
            <div className="pt-14 bg-[--gray-1]">{children}</div>
            <Toaster />
          </SteelProvider>
        </SettingsProvider>
      </ChatProvider>
    </PostHogProvider>
  );
}
