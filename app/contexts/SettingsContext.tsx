"use client";

import { createContext, useContext } from "react";
import { useLocalStorage } from "usehooks-ts";

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

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [currentSettings, setCurrentSettings] =
    useLocalStorage<SurfSettings | null>("chatSettings", null);

  const updateSettings = (newSettings: {
    [key in keyof SurfSettings]: SurfSettings[key];
  }) => {
    if (currentSettings) {
      setCurrentSettings((prev) => ({ ...prev, ...newSettings }));
    } else {
      setCurrentSettings(newSettings);
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        currentSettings,
        updateSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}