import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/today";

function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return false;
  }
  if (error instanceof ApiError && !error.retryable) {
    return false;
  }
  return failureCount < 2;
}

export function createDaynestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: shouldRetry,
      },
    },
  });
}
