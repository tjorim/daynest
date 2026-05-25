import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTodayActions } from "@/features/today/useTodayActions";

const todayApiMock = vi.hoisted(() => ({
  completeRoutineTask: vi.fn(),
  completeChore: vi.fn(),
  createPlannedItem: vi.fn(),
  deletePlannedItem: vi.fn(),
  rescheduleChore: vi.fn(),
  skipRoutineTask: vi.fn(),
  skipChore: vi.fn(),
  skipMedicationDose: vi.fn(),
  startRoutineTask: vi.fn(),
  takeMedicationDose: vi.fn(),
  updatePlannedItem: vi.fn(),
}));

vi.mock("@/lib/api/today", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/today")>("@/lib/api/today");
  return {
    ...actual,
    completeRoutineTask: todayApiMock.completeRoutineTask,
    completeChore: todayApiMock.completeChore,
    createPlannedItem: todayApiMock.createPlannedItem,
    deletePlannedItem: todayApiMock.deletePlannedItem,
    rescheduleChore: todayApiMock.rescheduleChore,
    skipRoutineTask: todayApiMock.skipRoutineTask,
    skipChore: todayApiMock.skipChore,
    skipMedicationDose: todayApiMock.skipMedicationDose,
    startRoutineTask: todayApiMock.startRoutineTask,
    takeMedicationDose: todayApiMock.takeMedicationDose,
    updatePlannedItem: todayApiMock.updatePlannedItem,
  };
});

describe("useTodayActions", () => {
  beforeEach(() => {
    todayApiMock.completeRoutineTask.mockReset().mockResolvedValue({});
    todayApiMock.completeChore.mockReset().mockResolvedValue({});
    todayApiMock.createPlannedItem.mockReset().mockResolvedValue({});
    todayApiMock.deletePlannedItem.mockReset().mockResolvedValue({});
    todayApiMock.rescheduleChore.mockReset().mockResolvedValue({});
    todayApiMock.skipRoutineTask.mockReset().mockResolvedValue({});
    todayApiMock.skipChore.mockReset().mockResolvedValue({});
    todayApiMock.skipMedicationDose.mockReset().mockResolvedValue({});
    todayApiMock.startRoutineTask.mockReset().mockResolvedValue({});
    todayApiMock.takeMedicationDose.mockReset().mockResolvedValue({});
    todayApiMock.updatePlannedItem.mockReset().mockResolvedValue({});
  });

  it.each([
    {
      label: "startRoutineTask",
      call: (actions: ReturnType<typeof useTodayActions>) => actions.startRoutineTask(31),
      verify: () => expect(todayApiMock.startRoutineTask).toHaveBeenCalledWith(31),
    },
    {
      label: "completeRoutineTask",
      call: (actions: ReturnType<typeof useTodayActions>) => actions.completeRoutineTask(32),
      verify: () => expect(todayApiMock.completeRoutineTask).toHaveBeenCalledWith(32),
    },
    {
      label: "skipRoutineTask",
      call: (actions: ReturnType<typeof useTodayActions>) => actions.skipRoutineTask(33),
      verify: () => expect(todayApiMock.skipRoutineTask).toHaveBeenCalledWith(33),
    },
    {
      label: "completeChore",
      call: (actions: ReturnType<typeof useTodayActions>) => actions.completeChore(11),
      verify: () => expect(todayApiMock.completeChore).toHaveBeenCalledWith(11),
    },
    {
      label: "skipChore",
      call: (actions: ReturnType<typeof useTodayActions>) => actions.skipChore(12),
      verify: () => expect(todayApiMock.skipChore).toHaveBeenCalledWith(12),
    },
    {
      label: "takeMedicationDose",
      call: (actions: ReturnType<typeof useTodayActions>) => actions.takeMedicationDose(14),
      verify: () => expect(todayApiMock.takeMedicationDose).toHaveBeenCalledWith(14),
    },
    {
      label: "skipMedicationDose",
      call: (actions: ReturnType<typeof useTodayActions>) => actions.skipMedicationDose(16),
      verify: () => expect(todayApiMock.skipMedicationDose).toHaveBeenCalledWith(16),
    },
    {
      label: "deletePlannedItem",
      call: (actions: ReturnType<typeof useTodayActions>) => actions.deletePlannedItem(15),
      verify: () => expect(todayApiMock.deletePlannedItem).toHaveBeenCalledWith(15, "this"),
    },
  ])("runs $label and refreshes by default", async ({ call, verify }) => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTodayActions(onRefresh));

    await act(async () => {
      await call(result.current);
    });

    verify();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("reschedules chores by one day and refreshes by default", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTodayActions(onRefresh));

    await act(async () => {
      await result.current.rescheduleChoreByOneDay(13, "2026-05-16");
    });

    expect(todayApiMock.rescheduleChore).toHaveBeenCalledWith(13, "2026-05-17");
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("creates planned items via quick add and refreshes by default", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTodayActions(onRefresh));

    await act(async () => {
      await result.current.createPlannedItem("Quick add task", "2026-05-17");
    });

    expect(todayApiMock.createPlannedItem).toHaveBeenCalledWith({
      title: "Quick add task",
      planned_for: "2026-05-17",
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("toggles planned items with full update payload and refreshes by default", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTodayActions(onRefresh));

    await act(async () => {
      await result.current.togglePlannedItem(
        {
          id: 22,
          title: "Order groceries",
          planned_for: "2026-05-17",
          time_of_day: "10:00:00",
          duration_minutes: 30,
          notes: "Before 6 PM",
          module_key: "shopping_list",
          recurrence_hint: null,
          rrule: "FREQ=WEEKLY;BYDAY=SU",
          recurrence_series_id: "bc0fbf8b-e4ae-40ba-a5b6-1424be5ca5dc",
          linked_source: "note",
          linked_ref: "abc",
          is_done: false,
        },
        true,
      );
    });

    expect(todayApiMock.updatePlannedItem).toHaveBeenCalledWith(22, {
      title: "Order groceries",
      planned_for: "2026-05-17",
      time_of_day: "10:00:00",
      duration_minutes: 30,
      notes: "Before 6 PM",
      module_key: "shopping_list",
      recurrence_hint: null,
      rrule: "FREQ=WEEKLY;BYDAY=SU",
      linked_source: "note",
      linked_ref: "abc",
      is_done: true,
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("supports skipping refresh and surfaces action errors", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTodayActions(onRefresh));

    await act(async () => {
      await result.current.deletePlannedItem(21, "this", { refresh: false });
    });
    expect(onRefresh).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.deletePlannedItem(21, "future", { refresh: false });
    });
    expect(todayApiMock.deletePlannedItem).toHaveBeenCalledWith(21, "future");

    const mutationError = new Error("Action failed hard");
    todayApiMock.skipChore.mockRejectedValueOnce(mutationError);
    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.skipChore(22);
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBe(mutationError);
    expect(result.current.actionError).toBe("Action failed hard");

    act(() => {
      result.current.clearActionError();
    });
    expect(result.current.actionError).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });

  it("passes recurring edit scope when editing planned items", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTodayActions(onRefresh));

    await act(async () => {
      await result.current.editPlannedItem(
        {
          id: 51,
          title: "Recurring",
          planned_for: "2026-05-17",
          time_of_day: null,
          duration_minutes: null,
          notes: null,
          module_key: null,
          recurrence_hint: null,
          rrule: "FREQ=DAILY",
          recurrence_series_id: "series",
          linked_source: null,
          linked_ref: null,
          is_done: false,
        },
        {
          title: "Recurring updated",
          planned_for: "2026-05-17",
        },
        "future",
      );
    });

    expect(todayApiMock.updatePlannedItem).toHaveBeenCalledWith(
      51,
      expect.objectContaining({
        title: "Recurring updated",
        planned_for: "2026-05-17",
        is_done: false,
      }),
      "future",
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
