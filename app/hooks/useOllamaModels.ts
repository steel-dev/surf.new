import { useQuery } from "@tanstack/react-query";

import { isLocalhost } from "@/lib/utils";
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
  return useQuery({
    queryKey: ["ollama-models"],
    queryFn: () => {
      if (isLocalhost()) {
        return fetchOllamaModels();
      }
      return Promise.resolve({ models: [] });
    },
    staleTime: 30 * 1000,
    retry: 2,
  });
}
