"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

interface ChatContextType {
  initialMessage: string | null;
  setInitialMessage: (message: string | null) => void;
  shouldAutoSubmit: boolean;
  setShouldAutoSubmit: (should: boolean) => void;
  clearInitialState: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [initialMessage, setInitialMessage] = useLocalStorage<string | null>(
    "initialMessage",
    null
  );
  const [shouldAutoSubmit, setShouldAutoSubmit] = useLocalStorage<boolean>(
    "shouldAutoSubmit",
    false
  );
  const pathname = usePathname();

  // Reset context when navigating away from chat
  useEffect(() => {
    if (pathname === "/") {
      clearInitialState();
    }
  }, [pathname]);

  const clearInitialState = () => {
    setInitialMessage(null);
    setShouldAutoSubmit(false);
  };

  return (
    <ChatContext.Provider
      value={{
        initialMessage,
        setInitialMessage,
        shouldAutoSubmit,
        setShouldAutoSubmit,
        clearInitialState,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
