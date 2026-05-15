// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TodayPage } from "@/features/today/TodayPage";

const todayApiMock = vi.hoisted(() => ({
  fetchToday: vi.fn(),
  mutation: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/api/today", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/today")>("@/lib/api/today");
  return {
    ...actual,
    completeRoutineTask: todayApiMock.mutation,
    completeChore: todayApiMock.mutation,
    deletePlannedItem: todayApiMock.mutation,
    fetchToday: todayApiMock.fetchToday,
    rescheduleChore: todayApiMock.mutation,
    skipRoutineTask: todayApiMock.mutation,
    skipChore: todayApiMock.mutation,
    skipMedicationDose: todayApiMock.mutation,
    startRoutineTask: todayApiMock.mutation,
    takeMedicationDose: todayApiMock.mutation,
    updatePlannedItem: todayApiMock.mutation,
  };
});

const todayPayload = {
  medication: [
    {
      medication_dose_instance_id: 1,
      medication_plan_id: 10,
      name: "Morning vitamin",
      instructions: "With breakfast",
      scheduled_at: "2026-05-15T08:00:00Z",
      status: "scheduled",
    },
    {
      medication_dose_instance_id: 2,
      medication_plan_id: 11,
      name: "Evening magnesium",
      instructions: "After dinner",
      scheduled_at: "2026-05-15T20:00:00Z",
      status: "taken",
    },
  ],
  medication_history: [],
  routines: [
    {
      task_instance_id: 3,
      routine_template_id: 30,
      title: "Pack lunch",
      status: "completed",
      scheduled_date: "2026-05-15",
      due_at: null,
    },
  ],
  overdue: [],
  due_today: [
    {
      chore_instance_id: 4,
      chore_template_id: 40,
      title: "Water plants",
      status: "pending",
      scheduled_date: "2026-05-15",
    },
  ],
  upcoming: [],
  planned: [
    {
      id: 5,
      title: "Order groceries",
      planned_for: "2026-05-15",
      notes: null,
      module_key: "shopping_list",
      recurrence_hint: null,
      linked_source: null,
      linked_ref: null,
      is_done: false,
    },
  ],
  day_items: [],
} satisfies Awaited<ReturnType<typeof import("@/lib/api/today").fetchToday>>;

describe("TodayPage", () => {
  beforeEach(() => {
    todayApiMock.fetchToday.mockReset();
    todayApiMock.fetchToday.mockResolvedValue(todayPayload);
  });

  it("shows the web focus panel with the next actionable item and progress", async () => {
    render(<TodayPage />);

    expect(await screen.findByText("Web focus")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Morning vitamin" })).toBeInTheDocument();
    expect(screen.getByLabelText("40% complete")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Today completion" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
  });

  it("renders quick-jump counts for each today section", async () => {
    render(<TodayPage />);

    const medicationJump = await screen.findByRole("link", { name: /medication today/i });
    expect(medicationJump).toHaveAttribute("href", "#medication-today");
    expect(within(medicationJump).getByText("1")).toBeInTheDocument();

    const dueTodayJump = screen.getByRole("link", { name: /due today/i });
    expect(dueTodayJump).toHaveAttribute("href", "#due-today");
    expect(within(dueTodayJump).getByText("1")).toBeInTheDocument();
  });
});
