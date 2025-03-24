"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export interface ModelSettings {
  max_tokens: number;
  temperature: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  [key: string]: string | number | undefined;
}

export interface AgentSettings {
  system_prompt?: string;
  num_images_to_keep?: number;
  wait_time_between_steps?: number;
  steps?: number;
  [key: string]: string | number | undefined;
}

export interface SurfSettings {
  selectedAgent: string;
  selectedProvider: string;
  selectedModel: string;
  modelSettings: ModelSettings;
  agentSettings: AgentSettings;
  providerApiKeys: {
    [provider: string]: string;
  };
}

interface SettingsContextType {
  currentSettings: SurfSettings | null;
  updateSettings: (newSettings: {
    [key in keyof SurfSettings]: SurfSettings[key];
  }) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SurfSettings | null>(null);

  // Define updateSettings function
  const updateSettings = useMemo(() => {
    return (newSettings: Partial<SurfSettings>) => {
      setSettings(prev => {
        if (!prev) return newSettings as SurfSettings;
        return { ...prev, ...newSettings };
      });
    };
  }, []);

  // Context value
  const contextValue = useMemo(() => {
    return {
      currentSettings: settings,
      updateSettings,
    };
  }, [settings, updateSettings]);

  return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
