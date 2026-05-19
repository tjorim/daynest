import { useState } from "react";
import {
  completeRoutineTask,
  completeChore,
  createPlannedItem,
  deletePlannedItem,
  rescheduleChore,
  skipRoutineTask,
  skipChore,
  skipMedicationDose,
  startRoutineTask,
  takeMedicationDose,
  updatePlannedItem,
  type PlannedItemModuleKey,
  type PlannedTodayItem,
} from "@/lib/api/today";
import { dayjs, toIsoDate } from "@/lib/dateUtils";

type MutationOptions = {
  refresh?: boolean;
};

function buildPlannedItemPayload(item: PlannedTodayItem, isDone: boolean) {
  return {
    title: item.title,
    planned_for: item.planned_for,
    notes: item.notes,
    module_key: item.module_key,
    recurrence_hint: item.recurrence_hint,
    linked_source: item.linked_source,
    linked_ref: item.linked_ref,
    is_done: isDone,
  };
}

export function useTodayActions(onRefresh: () => Promise<void>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const runAction = async (action: () => Promise<unknown>, options: MutationOptions = {}) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await action();
      if (options.refresh !== false) {
        await onRefresh();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    actionError,
    clearActionError: () => setActionError(null),
    startRoutineTask: (taskInstanceId: number, options?: MutationOptions) =>
      runAction(() => startRoutineTask(taskInstanceId), options),
    completeRoutineTask: (taskInstanceId: number, options?: MutationOptions) =>
      runAction(() => completeRoutineTask(taskInstanceId), options),
    skipRoutineTask: (taskInstanceId: number, options?: MutationOptions) =>
      runAction(() => skipRoutineTask(taskInstanceId), options),
    completeChore: (choreInstanceId: number, options?: MutationOptions) =>
      runAction(() => completeChore(choreInstanceId), options),
    skipChore: (choreInstanceId: number, options?: MutationOptions) =>
      runAction(() => skipChore(choreInstanceId), options),
    rescheduleChoreByOneDay: (
      choreInstanceId: number,
      scheduledDate: string,
      options?: MutationOptions,
    ) =>
      runAction(
        () => rescheduleChore(choreInstanceId, toIsoDate(dayjs(scheduledDate).add(1, "day"))),
        options,
      ),
    takeMedicationDose: (medicationDoseInstanceId: number, options?: MutationOptions) =>
      runAction(() => takeMedicationDose(medicationDoseInstanceId), options),
    skipMedicationDose: (medicationDoseInstanceId: number, options?: MutationOptions) =>
      runAction(() => skipMedicationDose(medicationDoseInstanceId), options),
    togglePlannedItem: (item: PlannedTodayItem, isDone: boolean, options?: MutationOptions) =>
      runAction(() => updatePlannedItem(item.id, buildPlannedItemPayload(item, isDone)), options),
    deletePlannedItem: (plannedItemId: number, options?: MutationOptions) =>
      runAction(() => deletePlannedItem(plannedItemId), options),
    createPlannedItem: (title: string, plannedFor: string, options?: MutationOptions) =>
      runAction(() => createPlannedItem({ title, planned_for: plannedFor }), options),
    editPlannedItem: (
      item: PlannedTodayItem,
      updates: {
        title: string;
        planned_for: string;
        notes?: string | null;
        module_key?: PlannedItemModuleKey | null;
        recurrence_hint?: string | null;
        linked_source?: string | null;
        linked_ref?: string | null;
      },
      options?: MutationOptions,
    ) =>
      runAction(
        () =>
          updatePlannedItem(item.id, {
            ...updates,
            is_done: item.is_done,
          }),
        options,
      ),
  };
}

