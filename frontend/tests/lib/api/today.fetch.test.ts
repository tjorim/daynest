import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getOidcAccessToken: vi.fn(() => "test-token"),
}));

import {
  deletePlannedItem,
  fetchCalendarDay,
  fetchCalendarMonth,
  fetchToday,
  updatePlannedItem,
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

  it("throws a clear error when fetchCalendarDay response is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            date: "2026-05-16",
            items: [{ item_type: "planned", item_id: "13" }],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(fetchCalendarDay("2026-05-16")).rejects.toMatchObject({
      name: "ApiError",
      message: expect.stringContaining("items.0.item_id"),
    });
  });

  it("passes delete scope for recurring planned-item removal", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { onLine: true });

    await expect(deletePlannedItem(42, "future")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/planned-items/42?scope=future"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("passes edit scope for recurring planned-item updates", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 42,
          title: "Update",
          planned_for: "2026-05-20",
          time_of_day: null,
          duration_minutes: null,
          notes: null,
          module_key: null,
          recurrence_hint: null,
          rrule: null,
          recurrence_series_id: null,
          linked_source: null,
          linked_ref: null,
          is_done: false,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { onLine: true });

    await expect(
      updatePlannedItem(
        42,
        { title: "Update", planned_for: "2026-05-20", is_done: false },
        "all",
      ),
    ).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/planned-items/42?scope=all"),
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
