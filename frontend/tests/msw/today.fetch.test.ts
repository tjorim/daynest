import { http, HttpResponse } from "msw/http";
import { afterEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/server";

import {
  deletePlannedItem,
  fetchToday,
  listPlannedItems,
  updatePlannedItem,
} from "@/lib/api/today";
import type { PlannedTodayItem, TodayPayload } from "@/api-types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("today API", () => {
  it("returns the today payload as the API sends it", async () => {
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

    server.use(http.get("/api/today", () => HttpResponse.json(payload)));

    await expect(fetchToday()).resolves.toEqual(payload);
  });

  it("reads a planned item with an urgent priority", async () => {
    // The backend's Priority enum has `urgent`; the old hand-written schema did not and failed the whole screen.
    const urgent: PlannedTodayItem = {
      id: 7,
      title: "Pay the invoice",
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
      auto_add_to_list_id: null,
      priority: "urgent",
      tags: [],
      is_done: false,
    };
    server.use(http.get("/api/planned-items", () => HttpResponse.json([urgent])));

    await expect(listPlannedItems()).resolves.toEqual([urgent]);
  });

  it("passes delete scope for recurring planned-item removal", async () => {
    const received: Request[] = [];
    server.use(
      http.delete("/api/planned-items/42", ({ request }) => {
        received.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    vi.stubGlobal("navigator", { onLine: true });

    await expect(deletePlannedItem(42, "future")).resolves.toBeUndefined();
    expect(received).toHaveLength(1);
    expect(new URL(received[0]!.url).searchParams.get("scope")).toBe("future");
  });

  it("passes edit scope for recurring planned-item updates", async () => {
    const received: Request[] = [];
    server.use(
      http.put("/api/planned-items/42", ({ request }) => {
        received.push(request);
        return HttpResponse.json({
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
        });
      }),
    );
    vi.stubGlobal("navigator", { onLine: true });

    await expect(
      updatePlannedItem(42, { title: "Update", planned_for: "2026-05-20", is_done: false }, "all"),
    ).resolves.toBeDefined();
    expect(received).toHaveLength(1);
    expect(new URL(received[0]!.url).searchParams.get("scope")).toBe("all");
  });
});
