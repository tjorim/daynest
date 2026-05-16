import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getStoredTokens: vi.fn(() => null),
}));

vi.mock("@/lib/api/auth", () => ({
  refreshSessionTokens: vi.fn(async () => null),
}));

import {
  fetchCalendarMonth,
  fetchToday,
  type CalendarMonthPayload,
  type TodayPayload,
} from "@/lib/api/today";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("today API response validation", () => {
  it("returns today payload when response matches schema", async () => {
    const payload: TodayPayload = {
      medication: [],
      medication_history: [],
      routines: [],
      overdue: [],
      due_today: [],
      upcoming: [],
      planned: [],
      day_items: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );

    await expect(fetchToday()).resolves.toEqual(payload);
  });

  it("throws a clear error when today response is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ medication: [] }), { status: 200 })),
    );

    await expect(fetchToday()).rejects.toMatchObject({
      name: "ApiError",
      message: expect.stringContaining("Invalid response format"),
    });
  });

  it("throws a clear error when fetchCalendarMonth response is invalid", async () => {
    const payload: CalendarMonthPayload = {
      year: 2026,
      month: 5,
      days: [{ date: "2026-05-16", total: 2, routines: 1, chores: 1, medications: 0, planned: 0 }],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ...payload,
            days: [{ ...payload.days[0], total: "2" }],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(fetchCalendarMonth(2026, 5)).rejects.toMatchObject({
      name: "ApiError",
      message: expect.stringContaining("days.0.total"),
    });
  });
});
