"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import Steel from "steel-sdk";
import { useSettings } from "./SettingsContext";

interface SteelContextType {
  currentSession: Steel.Session | null;
  createSession: () => Promise<Steel.Session | null>;
  isCreatingSession: boolean;
  resetSession: () => void;
  sessionTimeElapsed: number;
  isExpired: boolean;
  maxSessionDuration: number;
}

const MAX_SESSION_DURATION = 15 * 60; // 15 minutes in seconds

const SteelContext = createContext<SteelContextType | undefined>(undefined);

export function SteelProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSession] = useState<Steel.Session | null>(
    null
  );
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionTimeElapsed, setSessionTimeElapsed] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const { currentSettings } = useSettings();

  // Timer effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (currentSession && !isExpired) {
      intervalId = setInterval(() => {
        setSessionTimeElapsed((prev) => {
          const newTime = prev + 1;
          if (newTime >= MAX_SESSION_DURATION) {
            setIsExpired(true);
            clearInterval(intervalId);
            return MAX_SESSION_DURATION;
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentSession, isExpired]);

  async function createSession() {
    try {
      if (currentSettings) {
        setIsCreatingSession(true);
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
        setCurrentSession(session);
        setSessionTimeElapsed(0);
        setIsExpired(false);
        return session;
      }
    } catch (err) {
      console.error("Failed to create session:", err);
      return null;
    } finally {
      setIsCreatingSession(false);
    }
  }

  const resetSession = () => {
    setCurrentSession(null);
    setIsCreatingSession(false);
    setSessionTimeElapsed(0);
    setIsExpired(false);
  };

  return (
    <SteelContext.Provider
      value={{
        currentSession,
        createSession,
        isCreatingSession,
        resetSession,
        sessionTimeElapsed,
        isExpired,
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
