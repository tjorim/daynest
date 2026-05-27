import { useQuery } from "@tanstack/react-query";
import { fetchAnalyticsSummary, type AnalyticsPeriod } from "@/lib/api/today";
import { queryKeys } from "@/lib/query/queryKeys";

export function useStatsSummaryQuery(period: AnalyticsPeriod) {
  return useQuery({
    queryKey: queryKeys.analytics.summary(period),
    queryFn: ({ signal }) => fetchAnalyticsSummary(period, signal),
  });
}
