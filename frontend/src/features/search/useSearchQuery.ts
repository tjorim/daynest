import { useQuery } from "@tanstack/react-query";
import { searchItems } from "@/lib/api/search";
import { queryKeys } from "@/lib/query/queryKeys";

export function useSearchQuery(query: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.search.items(query),
    queryFn: ({ signal }) => searchItems(query, signal),
    enabled,
  });
}
