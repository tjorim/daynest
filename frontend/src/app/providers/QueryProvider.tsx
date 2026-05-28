import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createDaynestQueryClient } from "@/lib/query/queryClient";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createDaynestQueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
