"use client";

import { type ReactNode, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// Function to fetch agents
async function fetchAgents() {
  const response = await fetch("/api/agents");
  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.status}`);
  }
  return response.json();
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Prefetch agents data on mount
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ["agents"],
      queryFn: fetchAgents,
    });
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
