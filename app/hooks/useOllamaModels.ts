import { useQuery } from "@tanstack/react-query";

import { isLocalhost } from "@/lib/utils";

import { useSettings } from "@/app/contexts/SettingsContext";

interface OllamaModel {
  tag: string;
  base_name: string;
}

interface OllamaModelsResponse {
  models: OllamaModel[];
}

async function fetchOllamaModels(): Promise<OllamaModelsResponse> {
  const response = await fetch("/api/ollama/models");
  if (!response.ok) {
    throw new Error(`Failed to fetch Ollama models: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

export function useOllamaModels() {
  const { currentSettings } = useSettings();
  const isOllamaSelected = currentSettings?.selectedProvider === "ollama";
  const isLocal = isLocalhost();

  return useQuery({
    queryKey: ["ollama-models"],
    queryFn: fetchOllamaModels,
    staleTime: 60 * 1000, // Increase stale time to 1 minute
    retry: 2,
    // Only fetch when Ollama is selected and we're running locally
    enabled: isOllamaSelected && isLocal,
    // Skip refetching in the background when out of focus
    refetchOnWindowFocus: false,
  });
}
