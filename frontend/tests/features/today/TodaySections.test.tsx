// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  SectionCard,
  SummaryCard,
  WebFocusPanel,
  isItemActionable,
  isItemCompleted,
  buildDueTodayItems,
  buildRoutineItems,
  buildOverdueItems,
  buildUpcomingItems,
  buildPlannedItems,
  buildMedicationItems,
  buildMedicationHistoryItems,
  type BulkAction,
} from "@/features/today/TodaySections";
import type { SectionItem } from "@/lib/api/today";

describe("Today section components", () => {
  it("renders SummaryCard label and value", () => {
    render(<SummaryCard label="Due Today" value={3} tone="warning" />);

    expect(screen.getByText("Due Today")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders WebFocusPanel with next actionable item and progress", () => {
    render(
      <WebFocusPanel
        sections={[
          {
            key: "due-today",
            heading: "Due Today",
            items: [
              {
                id: "chore-1",
                title: "Water plants",
                choreInstanceId: 1,
                choreStatus: "pending",
              },
              {
                id: "chore-2",
                title: "Laundry",
                choreInstanceId: 2,
                choreStatus: "completed",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Today's focus")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Water plants" })).toBeInTheDocument();
    expect(screen.getByLabelText("50% complete")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Today completion" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    expect(screen.getByRole("link", { name: /due today/i })).toHaveAttribute("href", "#due-today");
  });

  it("renders WebFocusPanel empty state when no actionable items remain", () => {
    render(<WebFocusPanel sections={[{ key: "done", heading: "Done", items: [] }]} />);

    expect(screen.getByText("All clear for now")).toBeInTheDocument();
    expect(screen.getByText("No open actions remain for today.")).toBeInTheDocument();
    expect(screen.getByLabelText("0% complete")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Today completion" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("renders SectionCard items and runs configured bulk actions", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const runBulkDone = vi.fn().mockResolvedValue(undefined);
    const items: SectionItem[] = [
      {
        id: "item-1",
        title: "Water plants",
        subtitle: "Pending • May 16, 2026",
        statusLabel: "Pending",
        statusTone: "warning",
        choreInstanceId: 1,
        choreStatus: "pending",
      },
    ];

    const bulkActions: BulkAction[] = [
      {
        key: "bulk-done",
        label: "Bulk Done",
        buttonClassName: "btn-success",
        isAvailable: () => true,
        run: runBulkDone,
      },
    ];

    render(
      <SectionCard
        sectionId="due-today"
        heading="Due Today"
        items={items}
        onRefresh={onRefresh}
        bulkActions={bulkActions}
      />,
    );

    expect(screen.getByText("Due Today")).toBeInTheDocument();
    expect(screen.getByText("Water plants")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Select Water plants"));
    await user.click(screen.getByRole("button", { name: "Bulk Done" }));

    await waitFor(() => {
      expect(runBulkDone).toHaveBeenCalledWith(items[0]);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Bulk Done applied to 1 item.")).toBeInTheDocument();
  });

  it("shows failure feedback when a bulk action fails for all selected items", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const runBulkDone = vi.fn().mockRejectedValue(new Error("boom"));
    const items: SectionItem[] = [
      { id: "item-1", title: "Water plants", choreInstanceId: 1, choreStatus: "pending" },
    ];
    const bulkActions: BulkAction[] = [
      {
        key: "bulk-done",
        label: "Bulk Done",
        buttonClassName: "btn-success",
        isAvailable: () => true,
        run: runBulkDone,
      },
    ];

    render(
      <SectionCard
        sectionId="due-today"
        heading="Due Today"
        items={items}
        onRefresh={onRefresh}
        bulkActions={bulkActions}
      />,
    );

    await user.click(screen.getByLabelText("Select Water plants"));
    await user.click(screen.getByRole("button", { name: "Bulk Done" }));

    await waitFor(() => {
      expect(runBulkDone).toHaveBeenCalledTimes(1);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByText("Bulk Done failed for all 1 selected item.")).toBeInTheDocument();
  });

  it("shows partial-success feedback when a bulk action only succeeds for some items", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const runBulkDone = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom"));
    const items: SectionItem[] = [
      { id: "item-1", title: "Water plants", choreInstanceId: 1, choreStatus: "pending" },
      { id: "item-2", title: "Laundry", choreInstanceId: 2, choreStatus: "pending" },
    ];
    const bulkActions: BulkAction[] = [
      {
        key: "bulk-done",
        label: "Bulk Done",
        buttonClassName: "btn-success",
        isAvailable: () => true,
        run: runBulkDone,
      },
    ];

    render(
      <SectionCard
        sectionId="due-today"
        heading="Due Today"
        items={items}
        onRefresh={onRefresh}
        bulkActions={bulkActions}
      />,
    );

    await user.click(screen.getByLabelText("Select Water plants"));
    await user.click(screen.getByLabelText("Select Laundry"));
    await user.click(screen.getByRole("button", { name: "Bulk Done" }));

    await waitFor(() => {
      expect(runBulkDone).toHaveBeenCalledTimes(2);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Bulk Done updated 1 item and failed for 1.")).toBeInTheDocument();
  });

  it("selects all items via the select-all checkbox", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const runBulkDone = vi.fn().mockResolvedValue(undefined);
    const items: SectionItem[] = [
      { id: "item-1", title: "Water plants", choreInstanceId: 1, choreStatus: "pending" },
      { id: "item-2", title: "Laundry", choreInstanceId: 2, choreStatus: "pending" },
    ];
    const bulkActions: BulkAction[] = [
      {
        key: "bulk-done",
        label: "Bulk Done",
        buttonClassName: "btn-success",
        isAvailable: () => true,
        run: runBulkDone,
      },
    ];

    render(
      <SectionCard
        sectionId="due-today"
        heading="Due Today"
        items={items}
        onRefresh={onRefresh}
        bulkActions={bulkActions}
      />,
    );

    const selectAll = screen.getByRole("checkbox", { name: "Select all" });
    expect(selectAll).not.toBeChecked();

    await user.click(selectAll);
    expect(screen.getByLabelText("Select Water plants")).toBeChecked();
    expect(screen.getByLabelText("Select Laundry")).toBeChecked();

    await user.click(selectAll);
    expect(screen.getByLabelText("Select Water plants")).not.toBeChecked();
    expect(screen.getByLabelText("Select Laundry")).not.toBeChecked();
  });

});

const plannedBase = {
  notes: null,
  time_of_day: null,
  duration_minutes: null,
  module_key: null,
  recurrence_hint: null,
  linked_source: null,
  linked_ref: null,
};

describe("isItemActionable", () => {
  it("returns true for a pending chore", () => {
    expect(isItemActionable({ id: "c1", title: "T", choreInstanceId: 1, choreStatus: "pending" })).toBe(true);
  });

  it("returns false for a completed chore", () => {
    expect(isItemActionable({ id: "c1", title: "T", choreInstanceId: 1, choreStatus: "completed" })).toBe(false);
  });

  it("returns false for a skipped chore", () => {
    expect(isItemActionable({ id: "c1", title: "T", choreInstanceId: 1, choreStatus: "skipped" })).toBe(false);
  });

  it("returns true for a pending task", () => {
    expect(isItemActionable({ id: "t1", title: "T", taskInstanceId: 1, taskStatus: "pending" })).toBe(true);
  });

  it("returns false for a completed task", () => {
    expect(isItemActionable({ id: "t1", title: "T", taskInstanceId: 1, taskStatus: "completed" })).toBe(false);
  });

  it("returns true for a scheduled medication", () => {
    expect(isItemActionable({ id: "m1", title: "T", medicationDoseInstanceId: 1, medicationStatus: "scheduled" })).toBe(true);
  });

  it("returns true for a missed medication", () => {
    expect(isItemActionable({ id: "m1", title: "T", medicationDoseInstanceId: 1, medicationStatus: "missed" })).toBe(true);
  });

  it("returns false for a taken medication", () => {
    expect(isItemActionable({ id: "m1", title: "T", medicationDoseInstanceId: 1, medicationStatus: "taken" })).toBe(false);
  });

  it("returns true for an undone planned item", () => {
    expect(isItemActionable({ id: "p1", title: "T", plannedItem: { id: 1, title: "T", planned_for: "2026-05-20", is_done: false, ...plannedBase } })).toBe(true);
  });

  it("returns false for a done planned item", () => {
    expect(isItemActionable({ id: "p1", title: "T", plannedItem: { id: 1, title: "T", planned_for: "2026-05-20", is_done: true, ...plannedBase } })).toBe(false);
  });

  it("returns false when no typed fields are set", () => {
    expect(isItemActionable({ id: "x", title: "T" })).toBe(false);
  });
});

describe("isItemCompleted", () => {
  it("returns true for a completed chore", () => {
    expect(isItemCompleted({ id: "c1", title: "T", choreInstanceId: 1, choreStatus: "completed" })).toBe(true);
  });

  it("returns false for a pending chore", () => {
    expect(isItemCompleted({ id: "c1", title: "T", choreInstanceId: 1, choreStatus: "pending" })).toBe(false);
  });

  it("returns true for a completed task", () => {
    expect(isItemCompleted({ id: "t1", title: "T", taskInstanceId: 1, taskStatus: "completed" })).toBe(true);
  });

  it("returns true for a taken medication", () => {
    expect(isItemCompleted({ id: "m1", title: "T", medicationDoseInstanceId: 1, medicationStatus: "taken" })).toBe(true);
  });

  it("returns false for a scheduled medication", () => {
    expect(isItemCompleted({ id: "m1", title: "T", medicationDoseInstanceId: 1, medicationStatus: "scheduled" })).toBe(false);
  });

  it("returns true for a done planned item", () => {
    expect(isItemCompleted({ id: "p1", title: "T", plannedItem: { id: 1, title: "T", planned_for: "2026-05-20", is_done: true, ...plannedBase } })).toBe(true);
  });

  it("returns false when no typed fields are set", () => {
    expect(isItemCompleted({ id: "x", title: "T" })).toBe(false);
  });
});

describe("build item helpers", () => {
  it("buildDueTodayItems maps chore fields", () => {
    const result = buildDueTodayItems([{ chore_instance_id: 7, chore_template_id: 1, title: "Mop", status: "pending", scheduled_date: "2026-05-20" }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "due-7", title: "Mop", choreInstanceId: 7, choreStatus: "pending", statusTone: "warning" });
  });

  it("buildDueTodayItems uses success tone for completed status", () => {
    const [item] = buildDueTodayItems([{ chore_instance_id: 1, chore_template_id: 1, title: "T", status: "completed", scheduled_date: "2026-05-20" }]);
    expect(item!.statusTone).toBe("success");
  });

  it("buildRoutineItems maps task fields", () => {
    const result = buildRoutineItems([{ task_instance_id: 3, routine_template_id: 1, title: "Stretch", status: "pending", scheduled_date: "2026-05-20", due_at: null }]);
    expect(result[0]).toMatchObject({ id: "routine-3", taskInstanceId: 3, taskStatus: "pending", statusTone: "warning" });
  });

  it("buildOverdueItems sets overdue status", () => {
    const [item] = buildOverdueItems([{ chore_instance_id: 2, chore_template_id: 1, title: "Dishes", status: "pending", overdue_since: "2026-05-18" }]);
    expect(item).toMatchObject({ id: "overdue-2", statusLabel: "Overdue", statusTone: "danger", choreStatus: "pending" });
  });

  it("buildUpcomingItems sets upcoming status", () => {
    const [item] = buildUpcomingItems([{ chore_instance_id: 5, chore_template_id: 1, title: "Call", scheduled_date: "2026-05-22" }]);
    expect(item).toMatchObject({ id: "upcoming-5", statusLabel: "Upcoming", statusTone: "primary" });
  });

  it("buildPlannedItems maps planned item fields", () => {
    const [item] = buildPlannedItems([{ id: 9, title: "Read", planned_for: "2026-05-20", is_done: false, ...plannedBase }]);
    expect(item).toMatchObject({ id: "planned-9", statusLabel: "Planned", statusTone: "secondary" });
  });

  it("buildPlannedItems prefixes title with HH:MM when time is set", () => {
    const [item] = buildPlannedItems([{ id: 9, title: "Read", planned_for: "2026-05-20", is_done: false, ...plannedBase, time_of_day: "10:00:00" }]);
    expect(item.title).toBe("10:00 · Read");
  });

  it("buildPlannedItems sorts timed items before untimed and by time", () => {
    const items = buildPlannedItems([
      { id: 1, title: "Untimed", planned_for: "2026-05-20", is_done: false, ...plannedBase, time_of_day: null },
      { id: 2, title: "Late", planned_for: "2026-05-20", is_done: false, ...plannedBase, time_of_day: "12:00:00" },
      { id: 3, title: "Early", planned_for: "2026-05-20", is_done: false, ...plannedBase, time_of_day: "09:30:00" },
    ]);
    expect(items.map((item) => item.id)).toEqual(["planned-3", "planned-2", "planned-1"]);
  });

  it("buildPlannedItems uses done tone when is_done", () => {
    const [item] = buildPlannedItems([{ id: 9, title: "Read", planned_for: "2026-05-20", is_done: true, ...plannedBase }]);
    expect(item).toMatchObject({ statusLabel: "Done", statusTone: "success" });
  });

  it("buildMedicationItems maps medication fields", () => {
    const [item] = buildMedicationItems([{ medication_dose_instance_id: 4, medication_plan_id: 1, name: "Aspirin", status: "scheduled", scheduled_at: "2026-05-20T08:00:00Z", instructions: "" }]);
    expect(item).toMatchObject({ id: "medication-4", title: "Aspirin", medicationDoseInstanceId: 4, medicationStatus: "scheduled", statusTone: "info" });
  });

  it("buildMedicationHistoryItems maps history fields", () => {
    const [item] = buildMedicationHistoryItems([{ medication_dose_instance_id: 6, medication_plan_id: 1, name: "Ibuprofen", status: "taken", scheduled_at: "2026-05-19T09:00:00Z", instructions: "" }]);
    expect(item).toMatchObject({ id: "medication-history-6", title: "Ibuprofen", statusTone: "success" });
  });
});
