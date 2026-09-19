import { http, HttpResponse } from "msw";
import { MOCK_TODAY } from "../data/constants";

function periodDays(period: string): number {
  switch (period) {
    case "month":
      return 30;
    case "quarter":
      return 90;
    case "year":
      return 365;
    default:
      return 7;
  }
}

/**
 * Deterministic (no Math.random) daily series so mock responses stay stable
 * across test runs and screenshots: a slow seasonal wave plus a faster weekly
 * wave, offset per domain by `seed` so chores/routines/medications don't all
 * move in lockstep.
 */
function dailySeries(period: string, seed: number) {
  const days = periodDays(period);
  const end = new Date(`${MOCK_TODAY}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - (days - 1 - i));
    const wave = Math.sin(i / 6 + seed) * 0.18 + Math.sin(i / 37 + seed) * 0.08;
    const rate = Math.min(1, Math.max(0.35, 0.75 + wave));
    const total = 10 + (i % 4);
    const completed = Math.round(rate * total);
    return {
      date: date.toISOString().slice(0, 10),
      completed,
      taken: completed,
      total,
      completion_rate: completed / total,
      adherence_rate: completed / total,
    };
  });
}

function startDateFor(period: string): string {
  const days = periodDays(period);
  const start = new Date(`${MOCK_TODAY}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString().slice(0, 10);
}

function sumSeries(series: ReturnType<typeof dailySeries>, key: "completed" | "taken") {
  const completed = series.reduce((sum, day) => sum + day[key], 0);
  const total = series.reduce((sum, day) => sum + day.total, 0);
  return { completed, total, rate: total > 0 ? completed / total : 0 };
}

export const analyticsHandlers = [
  http.get("/api/analytics/summary", ({ request }) => {
    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? "week";
    const chores = dailySeries(period, 1);
    const routines = dailySeries(period, 2);
    const medications = dailySeries(period, 3);
    const choresSum = sumSeries(chores, "completed");
    const routinesSum = sumSeries(routines, "completed");
    const medicationsSum = sumSeries(medications, "taken");
    return HttpResponse.json({
      period,
      start_date: startDateFor(period),
      end_date: MOCK_TODAY,
      chores: {
        completion_rate: choresSum.rate,
        total_completed: choresSum.completed,
        total_scheduled: choresSum.total,
        daily_completions: chores,
        streaks: [{ chore_id: 30, name: "Water plants", current_streak: 5, longest_streak: 12 }],
        most_skipped: [],
      },
      medications: {
        adherence_rate: medicationsSum.rate,
        total_taken: medicationsSum.completed,
        total_scheduled: medicationsSum.total,
        daily_adherence: medications,
      },
      planned_items: {
        completion_rate: 0.6,
        total_completed: 9,
        total_scheduled: 15,
        daily_completions: [],
      },
      routines: {
        completion_rate: routinesSum.rate,
        total_completed: routinesSum.completed,
        total_scheduled: routinesSum.total,
        daily_completions: routines,
        streaks: [{ routine_id: 20, name: "Morning routine", current_streak: 7, longest_streak: 21 }],
      },
    });
  }),

  http.get("/api/search", ({ request }) => {
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
