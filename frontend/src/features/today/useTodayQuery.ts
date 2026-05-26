import { useQuery } from "@tanstack/react-query";
import { fetchToday } from "@/lib/api/today";
import { queryKeys } from "@/lib/query/queryKeys";

export function useTodayQuery() {
  return useQuery({
    queryKey: queryKeys.today.read(),
    queryFn: ({ signal }) => fetchToday(signal),
  });
}
