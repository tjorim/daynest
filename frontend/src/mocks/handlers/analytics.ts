import { http, HttpResponse } from "msw";
import { MOCK_TODAY } from "../data/constants";

export const analyticsHandlers = [
  http.get("/api/v1/analytics/summary", ({ request }) => {
    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? "week";
    return HttpResponse.json({
      period,
      start_date: "2026-05-22",
      end_date: MOCK_TODAY,
      chores: {
        completion_rate: 0.78,
        total_completed: 14,
        total_scheduled: 18,
        daily_completions: [],
        streaks: [{ chore_id: 30, name: "Water plants", current_streak: 5, longest_streak: 12 }],
        most_skipped: [],
      },
      medications: {
        adherence_rate: 0.93,
        total_taken: 13,
        total_scheduled: 14,
        daily_adherence: [],
      },
      planned_items: {
        completion_rate: 0.6,
        total_completed: 9,
        total_scheduled: 15,
        daily_completions: [],
      },
      routines: {
        completion_rate: 0.85,
        total_completed: 17,
        total_scheduled: 20,
        daily_completions: [],
        streaks: [{ routine_id: 20, name: "Morning routine", current_streak: 7, longest_streak: 21 }],
      },
    });
  }),

  http.get("/api/v1/search", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    return HttpResponse.json({
      query: q,
      routine_templates: [],
      chore_templates: [],
      medication_plans: [],
      planned_items: [],
    });
  }),
];
