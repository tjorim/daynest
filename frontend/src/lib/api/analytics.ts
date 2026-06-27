import { getJson } from "@/lib/api/http";
import { z } from "zod";

export type AnalyticsPeriod = "week" | "month" | "quarter" | "year";

export interface DailyCount {
  date: string;
  completed: number;
  total: number;
  completion_rate: number;
}

export interface ChoreStreak {
  chore_id: number;
  name: string;
  current_streak: number;
  longest_streak: number;
}

export interface SkippedChore {
  chore_id: number;
  name: string;
  skip_count: number;
}

export interface ChoreStats {
  completion_rate: number;
  total_completed: number;
  total_scheduled: number;
  daily_completions: DailyCount[];
  streaks: ChoreStreak[];
  most_skipped: SkippedChore[];
}

export interface DailyAdherence {
  date: string;
  taken: number;
  total: number;
  adherence_rate: number;
}

export interface MedicationAnalyticsStats {
  adherence_rate: number;
  total_taken: number;
  total_scheduled: number;
  daily_adherence: DailyAdherence[];
}

export interface PlannedItemAnalyticsStats {
  completion_rate: number;
  total_completed: number;
  total_scheduled: number;
  daily_completions: DailyCount[];
}

export interface RoutineStreak {
  routine_id: number;
  name: string;
  current_streak: number;
  longest_streak: number;
}

export interface RoutineAnalyticsStats {
  completion_rate: number;
  total_completed: number;
  total_scheduled: number;
  daily_completions: DailyCount[];
  streaks: RoutineStreak[];
}

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  start_date: string;
  end_date: string;
  chores: ChoreStats;
  medications: MedicationAnalyticsStats;
  planned_items: PlannedItemAnalyticsStats;
  routines: RoutineAnalyticsStats;
}

const dailyCountSchema = z.object({
  date: z.string(),
  completed: z.number(),
  total: z.number(),
  completion_rate: z.number(),
});

const analyticsSummarySchema = z.object({
  period: z.enum(["week", "month", "quarter", "year"]),
  start_date: z.string(),
  end_date: z.string(),
  chores: z.object({
    completion_rate: z.number(),
    total_completed: z.number(),
    total_scheduled: z.number(),
    daily_completions: z.array(dailyCountSchema),
    streaks: z.array(z.object({
      chore_id: z.number(),
      name: z.string(),
      current_streak: z.number(),
      longest_streak: z.number(),
    })),
    most_skipped: z.array(z.object({
      chore_id: z.number(),
      name: z.string(),
      skip_count: z.number(),
    })),
  }),
  medications: z.object({
    adherence_rate: z.number(),
    total_taken: z.number(),
    total_scheduled: z.number(),
    daily_adherence: z.array(z.object({
      date: z.string(),
      taken: z.number(),
      total: z.number(),
      adherence_rate: z.number(),
    })),
  }),
  planned_items: z.object({
    completion_rate: z.number(),
    total_completed: z.number(),
    total_scheduled: z.number(),
    daily_completions: z.array(dailyCountSchema),
  }),
  routines: z.object({
    completion_rate: z.number(),
    total_completed: z.number(),
    total_scheduled: z.number(),
    daily_completions: z.array(dailyCountSchema),
    streaks: z.array(z.object({
      routine_id: z.number(),
      name: z.string(),
      current_streak: z.number(),
      longest_streak: z.number(),
    })),
  }),
});

export async function fetchAnalyticsSummary(
  period: AnalyticsPeriod = "week",
  signal?: AbortSignal,
): Promise<AnalyticsSummary> {
  return getJson(
    `/api/analytics/summary?period=${period}`,
    analyticsSummarySchema,
    signal,
    2,
    "Failed to load analytics",
  );
}
