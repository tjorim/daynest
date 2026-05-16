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

  it("runs key mutation handlers and refreshes by default", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTodayActions(onRefresh));

    await act(async () => {
      await result.current.completeChore(11);
      await result.current.skipChore(12);
      await result.current.rescheduleChoreByOneDay(13, "2026-05-16");
      await result.current.startRoutineTask(31);
      await result.current.completeRoutineTask(32);
      await result.current.skipRoutineTask(33);
      await result.current.takeMedicationDose(14);
      await result.current.skipMedicationDose(16);
      await result.current.deletePlannedItem(15);
      await result.current.createPlannedItem("Quick add task", "2026-05-17");
      await result.current.togglePlannedItem(
        {
          id: 22,
          title: "Order groceries",
          planned_for: "2026-05-17",
          notes: "Before 6 PM",
          module_key: "shopping_list",
          recurrence_hint: null,
          linked_source: "note",
          linked_ref: "abc",
          is_done: false,
        },
        true,
      );
    });

    expect(todayApiMock.startRoutineTask).toHaveBeenCalledWith(31);
    expect(todayApiMock.completeRoutineTask).toHaveBeenCalledWith(32);
    expect(todayApiMock.skipRoutineTask).toHaveBeenCalledWith(33);
    expect(todayApiMock.completeChore).toHaveBeenCalledWith(11);
    expect(todayApiMock.skipChore).toHaveBeenCalledWith(12);
    expect(todayApiMock.rescheduleChore).toHaveBeenCalledWith(13, "2026-05-17");
    expect(todayApiMock.takeMedicationDose).toHaveBeenCalledWith(14);
    expect(todayApiMock.skipMedicationDose).toHaveBeenCalledWith(16);
    expect(todayApiMock.deletePlannedItem).toHaveBeenCalledWith(15);
    expect(todayApiMock.createPlannedItem).toHaveBeenCalledWith({
      title: "Quick add task",
      planned_for: "2026-05-17",
    });
    expect(todayApiMock.updatePlannedItem).toHaveBeenCalledWith(22, {
      title: "Order groceries",
      planned_for: "2026-05-17",
      notes: "Before 6 PM",
      module_key: "shopping_list",
      recurrence_hint: null,
      linked_source: "note",
      linked_ref: "abc",
      is_done: true,
    });
    expect(onRefresh).toHaveBeenCalledTimes(11);
  });

  it("supports skipping refresh and surfaces action errors", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTodayActions(onRefresh));

    await act(async () => {
      await result.current.deletePlannedItem(21, { refresh: false });
    });
    expect(onRefresh).not.toHaveBeenCalled();

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
});
