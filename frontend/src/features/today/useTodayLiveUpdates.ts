import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/api/serverConfig";
import { getOidcAccessToken } from "@/lib/auth/session";
import { queryKeys } from "@/lib/query/queryKeys";

export function useTodayLiveUpdates(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const token = getOidcAccessToken();
    if (!token) return;

    const url = buildApiUrl(`/api/v1/today/stream?token=${encodeURIComponent(token)}`);
    const es = new EventSource(url);
    let connected = false;

    es.addEventListener("open", () => {
      if (connected) {
        // Reconnect after a drop — missed events won't be replayed, so refetch.
        void queryClient.invalidateQueries({ queryKey: queryKeys.today.read() });
      }
      connected = true;
    });

    es.addEventListener("today_updated", () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.today.read() });
    });

    return () => {
      es.close();
    };
  }, [queryClient]);
}
