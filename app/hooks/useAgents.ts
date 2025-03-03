import { useQuery } from "@tanstack/react-query";

import { AvailableAgents } from "@/types/agents";

async function fetchAgents(): Promise<AvailableAgents> {
  const response = await fetch("/api/agents");
  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });
}
