// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatsPage } from "@/features/stats/StatsPage";
import { setLocale } from "@/paraglide/runtime";
import type { AnalyticsSummary, DailyCount } from "@/lib/api/analytics";
import { QueryTestProvider } from "../../utils/queryTestProvider";

const analyticsApiMock = vi.hoisted(() => ({ fetchAnalyticsSummary: vi.fn() }));

vi.mock("@/lib/api/analytics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/analytics")>("@/lib/api/analytics");
  return { ...actual, fetchAnalyticsSummary: analyticsApiMock.fetchAnalyticsSummary };
});

const daily: DailyCount[] = [
  { date: "2026-03-01", completed: 1, total: 2, completion_rate: 0.5 },
  { date: "2026-03-02", completed: 2, total: 2, completion_rate: 1 },
];

const summary: AnalyticsSummary = {
  period: "week",
  start_date: "2026-03-01",
  end_date: "2026-03-02",
  chores: {
    completion_rate: 0.75,
    total_completed: 3,
    total_scheduled: 4,
    daily_completions: daily,
    streaks: [],
    most_skipped: [],
  },
  medications: {
    adherence_rate: 1,
    total_taken: 0,
    total_scheduled: 0,
    daily_adherence: [],
  },
  planned_items: {
    completion_rate: 0,
    total_completed: 0,
    total_scheduled: 0,
    daily_completions: [],
  },
  routines: {
    completion_rate: 0,
    total_completed: 0,
    total_scheduled: 0,
    daily_completions: [],
    streaks: [],
  },
};

describe("StatsPage", () => {
  afterEach(() => {
    setLocale("en", { reload: false });
    analyticsApiMock.fetchAnalyticsSummary.mockReset();
  });

  it.each([
    ["en", "Mar 1 – Mar 2"],
    ["nl", "1 mrt – 2 mrt"],
  ] as const)("formats trend selection dates for %s", async (locale, expected) => {
    setLocale(locale, { reload: false });
    analyticsApiMock.fetchAnalyticsSummary.mockResolvedValue(summary);

    render(
      <QueryTestProvider>
        <StatsPage />
      </QueryTestProvider>,
    );

    const selections = await screen.findAllByText(new RegExp(expected));
    expect(selections.length).toBeGreaterThan(0);
  });
});
