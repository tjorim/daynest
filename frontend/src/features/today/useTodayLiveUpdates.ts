import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/api/serverConfig";
import { useOidcAccessToken } from "@/lib/auth/session";
import { queryKeys } from "@/lib/query/queryKeys";

export function useTodayLiveUpdates(): string | null {
  const queryClient = useQueryClient();
  const token = useOidcAccessToken();
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    setConnectionError(null);

    if (typeof EventSource === "undefined") return;
    if (!token) return;

    const url = buildApiUrl(`/api/today/stream?token=${encodeURIComponent(token)}`);
    const es = new EventSource(url);
    let connected = false;

    es.addEventListener("open", () => {
      setConnectionError(null);

      if (connected) {
        // Reconnect after a drop — missed events won't be replayed, so refetch.
        void queryClient.invalidateQueries({ queryKey: queryKeys.today.read() });
      }
      connected = true;
    });

    es.addEventListener("today_updated", () => {
      setConnectionError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.today.read() });
    });

    es.addEventListener("error", () => {
      setConnectionError(
        "Live Today updates were interrupted. Reconnecting with the latest session…",
      );
    });

    return () => {
      es.close();
    };
  }, [queryClient, token]);

  return connectionError;
}
