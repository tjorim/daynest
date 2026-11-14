import { getJson } from "@/lib/api/http";
import type { SearchResponse } from "@/api-types";
import * as m from "@/paraglide/messages";

export async function searchItems(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  return getJson<SearchResponse>(
    `/api/search?q=${encodeURIComponent(query)}`,
    signal,
    2,
    m.api_search_failed(),
  );
}
