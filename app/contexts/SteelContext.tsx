"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Steel from "steel-sdk";

import { useSettings } from "./SettingsContext";

interface SteelContextType {
  currentSession: Steel.Session | null;
  createSession: () => Promise<Steel.Session | null>;
  isCreatingSession: boolean;
  resetSession: () => Promise<void>;
  maxSessionDuration: number;
}

const MAX_SESSION_DURATION = 15 * 60; // 15 minutes in seconds

const SteelContext = createContext<SteelContextType | undefined>(undefined);

export function SteelProvider({ children }: { children: React.ReactNode }) {
  console.info("🔄 Initializing SteelProvider");
  const [currentSession, setCurrentSession] = useState<Steel.Session | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const { currentSettings } = useSettings();

  // Helper function to release a session
  const releaseSession = async (sessionId: string) => {
    console.info("🔓 Attempting to release session:", sessionId);
    try {
      await fetch(`/api/sessions/${sessionId}/release`, {
        method: "POST",
      });
      console.info("✅ Successfully released session:", sessionId);
    } catch (error) {
      console.error("❌ Failed to release session:", error);
    }
  };

  // Cleanup effect when page is closed/unloaded
  useEffect(() => {
    console.info("🧹 Setting up cleanup effect");
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentSession?.id) {
        console.info("🔄 BeforeUnload triggered - releasing session:", currentSession.id);
        navigator.sendBeacon(`/api/sessions/${currentSession.id}/release`);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      console.info("🧹 Cleaning up event listeners");
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (currentSession?.id) {
        console.info("🔓 Cleanup: releasing session:", currentSession.id);
        releaseSession(currentSession.id);
      }
    };
  }, [currentSession?.id]);

  async function createSession() {
    console.info("🚀 Attempting to create new session", { currentSettings });
    try {
      if (currentSettings) {
        setIsCreatingSession(true);
        console.info("⏳ Creating session with settings:", {
          agent_type: currentSettings.selectedAgent,
          timeout: MAX_SESSION_DURATION,
        });

        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_type: currentSettings.selectedAgent,
            timeout: MAX_SESSION_DURATION,
          }),
        });
        const session = await response.json();
        console.info("✅ Session created successfully:", session);
        setCurrentSession(session);
        return session;
      }
    } catch (err) {
      console.error("❌ Failed to create session:", err);
      return null;
    } finally {
      setIsCreatingSession(false);
    }
  }

  const resetSession = async () => {
    console.info("🔄 Resetting session");
    if (currentSession?.id) {
      console.info("🔓 Releasing current session before reset:", currentSession.id);
      await releaseSession(currentSession.id);
    }

    setCurrentSession(null);
    setIsCreatingSession(false);
    console.info("✅ Session reset complete");
  };

  return (
    <SteelContext.Provider
      value={{
        currentSession,
        createSession,
        isCreatingSession,
        resetSession,
        maxSessionDuration: MAX_SESSION_DURATION,
      }}
    >
      {children}
    </SteelContext.Provider>
  );
}

export function useSteelContext() {
  const context = useContext(SteelContext);
  if (context === undefined) {
    throw new Error("useSteelContext must be used within a SteelProvider");
  }
  return context;
}
