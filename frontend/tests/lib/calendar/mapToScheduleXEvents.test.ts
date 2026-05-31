import { describe, expect, it } from "vitest";
import { CALENDAR_COLORS, mapToScheduleXEvents } from "@/features/calendar/mapToScheduleXEvents";
import type { UnifiedDayItem } from "@/lib/api/today";

function buildItem(overrides: Partial<UnifiedDayItem> = {}): UnifiedDayItem {
  return {
    item_type: "routine",
    item_id: 42,
    title: "Morning routine",
    status: "pending",
    scheduled_at: "2026-05-31T08:15:00",
    scheduled_date: "2026-05-31",
    duration_minutes: 45,
    detail: null,
    module_key: null,
    ...overrides,
  };
}

describe("mapToScheduleXEvents", () => {
  it("maps timed events and carries custom modal fields", () => {
    expect(mapToScheduleXEvents([buildItem({ module_key: "shared_calendar" })])).toEqual([
      {
        id: "routine-42",
        title: "Morning routine",
        start: "2026-05-31 08:15",
        end: "2026-05-31 09:00",
        calendarId: "routine",
        _type: "routine",
        _status: "pending",
        _itemId: 42,
        _moduleKey: "shared_calendar",
      },
    ]);
  });

  it("maps all-day events to their scheduled date", () => {
    const [event] = mapToScheduleXEvents([
      buildItem({ item_type: "chore", scheduled_at: null, scheduled_date: "2026-06-01" }),
    ]);

    expect(event).toMatchObject({ start: "2026-06-01", end: "2026-06-01" });
  });

  it("defaults timed events without a duration to 30 minutes", () => {
    const [event] = mapToScheduleXEvents([buildItem({ duration_minutes: null })]);

    expect(event?.end).toBe("2026-05-31 08:45");
  });

  it("maps every unified item type to its matching calendar", () => {
    const itemTypes: UnifiedDayItem["item_type"][] = ["routine", "chore", "medication", "planned"];

    expect(
      mapToScheduleXEvents(
        itemTypes.map((item_type, index) => buildItem({ item_type, item_id: index })),
      ).map((event) => event.calendarId),
    ).toEqual(itemTypes);
  });

  it("defines colors for every unified item type", () => {
    expect(CALENDAR_COLORS).toEqual({
      routine: "#0d6efd",
      chore: "#ffc107",
      medication: "#0dcaf0",
      planned: "#6f42c1",
    });
  });
});
