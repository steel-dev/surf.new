import { useQuery } from "@tanstack/react-query";

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
    queryFn: fetchOllamaModels,
    staleTime: 30 * 1000,
    retry: 2,
  });
}
