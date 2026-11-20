import { getJson } from "@/lib/api/http";
import type { AnalyticsPeriod, AnalyticsSummary } from "@/api-types";
import * as m from "@/paraglide/messages";

export async function fetchAnalyticsSummary(
  period: AnalyticsPeriod = "week",
  signal?: AbortSignal,
): Promise<AnalyticsSummary> {
  return getJson<AnalyticsSummary>(
    `/api/analytics/summary?period=${period}`,
    signal,
    2,
    m.api_analytics_load_failed(),
  );
}
