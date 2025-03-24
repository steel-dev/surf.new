"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

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

let renderCount = 0;

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const renderIndex = ++renderCount;
  console.log(`[RENDER] SettingsProvider rendering #${renderIndex}`);

  const [settings, setSettings] = useState<SurfSettings | null>(null);

  // Log settings changes
  useEffect(() => {
    if (settings) {
      console.log("[SETTINGS] Current settings state:", {
        agent: settings.selectedAgent,
        provider: settings.selectedProvider,
        model: settings.selectedModel,
        hasApiKeys: Object.keys(settings.providerApiKeys || {}).length > 0,
      });
    }
  }, [settings]);

  // Load settings from localStorage
  useEffect(() => {
    console.log("[EFFECT] Initializing settings from localStorage");

    // Initialize with default settings for SSR
    const initialSettings = {
      selectedAgent: "browser_use_agent",
      selectedProvider: "openai",
      selectedModel: "gpt-4-turbo",
      modelSettings: {
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 1.0,
        top_k: undefined,
        frequency_penalty: undefined,
        presence_penalty: undefined,
      },
      agentSettings: {},
      providerApiKeys: {},
    };
    setSettings(initialSettings);
    console.log("[SETTINGS] Applied default settings");

    try {
      // Then hydrate with localStorage values on client-side
      const savedSettings = localStorage.getItem("settings");
      if (savedSettings) {
        console.log("[STORAGE] Found saved settings in localStorage");
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(currentSettings => {
          const mergedSettings = {
            ...initialSettings,
            ...parsedSettings,
            // Always ensure selectedAgent is consistent to prevent hydration issues
            selectedAgent: "browser_use_agent",
          };
          console.log("[SETTINGS] Merged settings from localStorage");
          return mergedSettings;
        });
      }
    } catch (error) {
      console.error("[ERROR] Error loading settings:", error);
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    if (settings) {
      console.log("[STORAGE] Saving settings to localStorage");
      localStorage.setItem("settings", JSON.stringify(settings));
    }
  }, [settings]);

  // Define updateSettings function
  const updateSettings = useMemo(() => {
    console.log("[FUNCTION] Creating updateSettings function");
    return (newSettings: Partial<SurfSettings>) => {
      console.log("[UPDATE] Updating settings with:", newSettings);
      setSettings(prev => {
        if (!prev) return newSettings as SurfSettings;
        return { ...prev, ...newSettings };
      });
    };
  }, []);

  // Context value
  const contextValue = useMemo(() => {
    console.log("[MEMO] Creating new SettingsContext value");
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
