// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { QueryTestProvider } from "../../utils/queryTestProvider";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearch: () => ({
      month: undefined as string | undefined,
      date: undefined as string | undefined,
    }),
  };
});

const calendarApiMock = vi.hoisted(() => ({
  fetchCalendarRange: vi.fn(),
  fetchCalendarDay: vi.fn(),
  listPlannedItems: vi.fn(),
}));

vi.mock("@/lib/api/today", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/today")>("@/lib/api/today");
  return {
    ...actual,
    fetchCalendarRange: calendarApiMock.fetchCalendarRange,
    fetchCalendarDay: calendarApiMock.fetchCalendarDay,
    listPlannedItems: calendarApiMock.listPlannedItems,
  };
});

describe("CalendarPage", () => {
  beforeEach(() => {
    calendarApiMock.fetchCalendarRange.mockReset();
    calendarApiMock.fetchCalendarDay.mockReset();
    calendarApiMock.listPlannedItems.mockReset();
    calendarApiMock.fetchCalendarRange.mockResolvedValue({
      items: [
        {
          item_type: "routine",
          item_id: 1,
          title: "Morning stretch",
          status: "pending",
          scheduled_at: null,
          scheduled_date: "2026-05-16",
          detail: null,
          module_key: null,
        },
      ],
    });
    calendarApiMock.fetchCalendarDay.mockResolvedValue({
      date: "2026-05-16",
      items: [
        {
          item_type: "routine",
          item_id: 1,
          title: "Morning stretch",
          status: "pending",
          scheduled_at: null,
          scheduled_date: "2026-05-16",
          detail: null,
          module_key: null,
        },
      ],
    });
    calendarApiMock.listPlannedItems.mockResolvedValue([]);
  });

  it("renders Schedule-X controls and the retained planned item sidebar", async () => {
    render(
      <QueryTestProvider>
        <CalendarPage />
      </QueryTestProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next period" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select View" })).toBeInTheDocument();
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

    render(
      <QueryTestProvider>
        <CalendarPage />
      </QueryTestProvider>,
    );

    expect(await screen.findByText(/🔁 Grocery run/)).toBeInTheDocument();
  });
});
