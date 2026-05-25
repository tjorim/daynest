// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "@/features/calendar/CalendarPage";

const calendarApiMock = vi.hoisted(() => ({
  fetchCalendarMonth: vi.fn(),
  fetchCalendarDay: vi.fn(),
  listPlannedItems: vi.fn(),
}));

vi.mock("@/lib/api/today", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/today")>("@/lib/api/today");
  return {
    ...actual,
    fetchCalendarMonth: calendarApiMock.fetchCalendarMonth,
    fetchCalendarDay: calendarApiMock.fetchCalendarDay,
    listPlannedItems: calendarApiMock.listPlannedItems,
  };
});

describe("CalendarPage", () => {
  beforeEach(() => {
    calendarApiMock.fetchCalendarMonth.mockReset();
    calendarApiMock.fetchCalendarDay.mockReset();
    calendarApiMock.listPlannedItems.mockReset();
    calendarApiMock.fetchCalendarMonth.mockResolvedValue({
      year: 2026,
      month: 5,
      days: [{ date: "2026-05-16", total: 2, routines: 1, chores: 1, medications: 0, planned: 0 }],
    });
    calendarApiMock.fetchCalendarDay.mockResolvedValue({
      date: "2026-05-16",
      items: [{ item_type: "routine", item_id: 1, title: "Morning stretch", status: "pending", scheduled_at: null, scheduled_date: "2026-05-16", detail: null, module_key: null }],
    });
    calendarApiMock.listPlannedItems.mockResolvedValue([]);
  });

  it("renders month controls and extracted side panels", async () => {
    render(<CalendarPage />);

    expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "This month" })).toBeInTheDocument();
    expect(await screen.findByText(/Day details/i)).toBeInTheDocument();
    expect(screen.getByText("Quick add planned item")).toBeInTheDocument();
    expect(screen.getByLabelText("Repeat")).toBeInTheDocument();
    expect(screen.getByText("Backup export/import")).toBeInTheDocument();
  });

  it("shows a repeat indicator for recurring planned items in calendar view", async () => {
    calendarApiMock.listPlannedItems.mockResolvedValueOnce([
      {
        id: 99,
        title: "Grocery run",
        planned_for: "2026-05-16",
        time_of_day: null,
        duration_minutes: null,
        notes: null,
        module_key: "recurring_grocery",
        recurrence_hint: "weekly",
        rrule: "FREQ=WEEKLY;BYDAY=SA",
        recurrence_series_id: "9f5ed4cc-f797-4e6e-b331-a6ca889fbcb7",
        linked_source: null,
        linked_ref: null,
        is_done: false,
      },
    ]);

    render(<CalendarPage />);

    expect(await screen.findByText(/🔁 Grocery run/)).toBeInTheDocument();
  });
});
