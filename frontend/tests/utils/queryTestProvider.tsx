import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function createQueryTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function QueryTestProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryTestClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
