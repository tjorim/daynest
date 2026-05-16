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
    expect(screen.getByText("Backup export/import")).toBeInTheDocument();
  });
});

