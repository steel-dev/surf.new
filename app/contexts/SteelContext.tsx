"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Steel from "steel-sdk";

import { useTimerStore } from "@/app/stores/timerStore";

import { useSettings } from "./SettingsContext";

interface SteelContextType {
  currentSession: Steel.Session | null;
  createSession: () => Promise<Steel.Session | null>;
  isCreatingSession: boolean;
  resetSession: () => Promise<void>;
  isExpired: boolean;
  maxSessionDuration: number;
}

const MAX_SESSION_DURATION = 15 * 60; // 15 minutes in seconds

const SteelContext = createContext<SteelContextType | undefined>(undefined);

let renderCount = 0;

// Timer controller component that manages the timer without storing state
function TimerController({
  session,
  onExpire,
}: {
  session: Steel.Session | null;
  onExpire: () => void;
}) {
  // Use Zustand store for timer state
  const { incrementTime, startTimer, stopTimer, isTimerActive, sessionTimeElapsed, expireTimer } =
    useTimerStore();

  // Ref to keep track of expiry across renders
  const isExpiredRef = useRef(false);

  // Timer effect to handle counting
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (session && !isExpiredRef.current) {
      console.log("[TIMER] Starting session timer");
      startTimer();

      intervalId = setInterval(() => {
        console.log("[TIMER] Tick"); // Debug log
        incrementTime();

        // Check for expiry
        if (
          useTimerStore.getState().sessionTimeElapsed + 1 >= MAX_SESSION_DURATION &&
          !isExpiredRef.current
        ) {
          console.log("[TIMER] Session expired by timer");
          isExpiredRef.current = true;
          expireTimer();
          onExpire();
          clearInterval(intervalId);
        }
      }, 1000);
    }

    return () => {
      if (intervalId) {
        console.log("[TIMER] Clearing session timer");
        clearInterval(intervalId);
        stopTimer();
      }
    };
  }, [session, startTimer, stopTimer, incrementTime, onExpire]);

  // Effect to handle expiry
  useEffect(() => {
    if (sessionTimeElapsed >= MAX_SESSION_DURATION && !isExpiredRef.current) {
      console.log("[TIMER] Session expired by timer");
      isExpiredRef.current = true;
      expireTimer();
      onExpire();
    }
  }, [sessionTimeElapsed, expireTimer, onExpire]);

  return null; // This component doesn't render anything
}

export function SteelProvider({ children }: { children: React.ReactNode }) {
  const renderIndex = ++renderCount;
  console.log(`[RENDER] SteelProvider rendering #${renderIndex}`);

  const [currentSession, setCurrentSession] = useState<Steel.Session | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const { currentSettings } = useSettings();

  // Get resetTimer from our store
  const resetTimer = useTimerStore(state => state.resetTimer);

  // Handler for timer expiry
  const handleExpire = useCallback(() => {
    setIsExpired(true);
  }, []);

  // Track settings changes
  useEffect(() => {
    console.log("[CHANGE] SteelProvider settings changed:", {
      provider: currentSettings?.selectedProvider,
      agent: currentSettings?.selectedAgent,
      model: currentSettings?.selectedModel,
    });
  }, [currentSettings]);

  // Helper function to release a session
  const releaseSession = useCallback(async (sessionId: string) => {
    console.log("[ACTION] Releasing session:", sessionId);
    try {
      await fetch(`/api/sessions/${sessionId}/release`, {
        method: "POST",
      });
      console.log("[ACTION] Session released successfully:", sessionId);
    } catch (error) {
      console.error("[ERROR] Failed to release session:", error);
    }
  }, []);

  // Cleanup effect when page is closed/unloaded
  useEffect(() => {
    console.log("[EFFECT] Setting up cleanup handlers");

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentSession?.id) {
        console.log("[UNLOAD] BeforeUnload triggered - releasing session:", currentSession.id);
        navigator.sendBeacon(`/api/sessions/${currentSession.id}/release`);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      console.log("[CLEANUP] Removing event listeners");
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (currentSession?.id) {
        console.log("[CLEANUP] Releasing session on unmount:", currentSession.id);
        releaseSession(currentSession.id);
      }
    };
  }, [currentSession?.id, releaseSession]);

  const createSession = useCallback(async () => {
    console.log("[ACTION] Creating new session with settings:", {
      agent: currentSettings?.selectedAgent,
      timeout: MAX_SESSION_DURATION,
    });

    try {
      if (currentSettings) {
        setIsCreatingSession(true);
        // Reset timer when creating a new session
        resetTimer();

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
        console.log("[SUCCESS] Session created:", session);
        setCurrentSession(session);
        setIsExpired(false);
        return session;
      }
    } catch (err) {
      console.error("[ERROR] Failed to create session:", err);
      return null;
    } finally {
      setIsCreatingSession(false);
    }
  }, [currentSettings, resetTimer]);

  const resetSession = useCallback(async () => {
    console.log("[ACTION] Resetting session");
    if (currentSession?.id) {
      console.log("[ACTION] Releasing current session before reset:", currentSession.id);
      await releaseSession(currentSession.id);
    }

    setCurrentSession(null);
    setIsCreatingSession(false);
    setIsExpired(false);
    resetTimer();
    console.log("[ACTION] Session reset complete");
  }, [currentSession?.id, releaseSession, resetTimer]);

  // Context value without timer values
  const contextValue = useMemo(() => {
    console.log("[MEMO] Creating new SteelContext value");
    return {
      currentSession,
      createSession,
      isCreatingSession,
      resetSession,
      isExpired,
      maxSessionDuration: MAX_SESSION_DURATION,
    };
  }, [currentSession, createSession, isCreatingSession, resetSession, isExpired]);

  return (
    <SteelContext.Provider value={contextValue}>
      <TimerController session={currentSession} onExpire={handleExpire} />
      {children}
    </SteelContext.Provider>
  );
}

export function useSteelContext() {
  const context = useContext(SteelContext);

  if (context === undefined) {
    throw new Error("useSteelContext must be used within a SteelProvider");
  }

  // Return context without adding the default sessionTimeElapsed
  // Components that need time should get it directly from useTimerStore
  return context;
}
