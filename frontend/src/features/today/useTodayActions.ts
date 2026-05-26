import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  type PlannedItemDeleteScope,
  type PlannedItemEditScope,
  type PlannedItemModuleKey,
  type PlannedItemUpdateInput,
  type PlannedTodayItem,
} from "@/lib/api/today";
import { dayjs, toIsoDate } from "@/lib/dateUtils";
import { queryKeys } from "@/lib/query/queryKeys";

type MutationOptions = {
  refresh?: boolean;
};

function buildPlannedItemPayload(item: PlannedTodayItem, isDone: boolean) {
  return {
    title: item.title,
    planned_for: item.planned_for,
    time_of_day: item.time_of_day,
    duration_minutes: item.duration_minutes,
    notes: item.notes,
    module_key: item.module_key,
    recurrence_hint: item.recurrence_hint,
    rrule: item.rrule,
    linked_source: item.linked_source,
    linked_ref: item.linked_ref,
    is_done: isDone,
  };
}

export function useTodayActions(onRefresh: () => Promise<void>) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidateRelatedQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.today.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.plannedItems.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all }),
    ]);
  };

  const startRoutineTaskMutation = useMutation({
    mutationFn: (taskInstanceId: number) => startRoutineTask(taskInstanceId),
    onSuccess: invalidateRelatedQueries,
  });
  const completeRoutineTaskMutation = useMutation({
    mutationFn: (taskInstanceId: number) => completeRoutineTask(taskInstanceId),
    onSuccess: invalidateRelatedQueries,
  });
  const skipRoutineTaskMutation = useMutation({
    mutationFn: (taskInstanceId: number) => skipRoutineTask(taskInstanceId),
    onSuccess: invalidateRelatedQueries,
  });
  const completeChoreMutation = useMutation({
    mutationFn: (choreInstanceId: number) => completeChore(choreInstanceId),
    onSuccess: invalidateRelatedQueries,
  });
  const skipChoreMutation = useMutation({
    mutationFn: (choreInstanceId: number) => skipChore(choreInstanceId),
    onSuccess: invalidateRelatedQueries,
  });
  const rescheduleChoreMutation = useMutation({
    mutationFn: ({ choreInstanceId, scheduledDate }: { choreInstanceId: number; scheduledDate: string }) =>
      rescheduleChore(choreInstanceId, scheduledDate),
    onSuccess: invalidateRelatedQueries,
  });
  const takeMedicationDoseMutation = useMutation({
    mutationFn: (medicationDoseInstanceId: number) => takeMedicationDose(medicationDoseInstanceId),
    onSuccess: invalidateRelatedQueries,
  });
  const skipMedicationDoseMutation = useMutation({
    mutationFn: (medicationDoseInstanceId: number) => skipMedicationDose(medicationDoseInstanceId),
    onSuccess: invalidateRelatedQueries,
  });
  const updatePlannedItemMutation = useMutation({
    mutationFn: ({
      plannedItemId,
      input,
      scope,
    }: {
      plannedItemId: number;
      input: PlannedItemUpdateInput;
      scope: PlannedItemEditScope;
    }) => updatePlannedItem(plannedItemId, input, scope),
    onSuccess: invalidateRelatedQueries,
  });
  const deletePlannedItemMutation = useMutation({
    mutationFn: ({ plannedItemId, scope }: { plannedItemId: number; scope: PlannedItemDeleteScope }) =>
      deletePlannedItem(plannedItemId, scope),
    onSuccess: invalidateRelatedQueries,
  });
  const createPlannedItemMutation = useMutation({
    mutationFn: ({ title, plannedFor }: { title: string; plannedFor: string }) =>
      createPlannedItem({ title, planned_for: plannedFor }),
    onSuccess: invalidateRelatedQueries,
  });

  const runAction = async <TVariables>(
    mutation: { mutateAsync: (variables: TVariables) => Promise<unknown> },
    variables: TVariables,
    options: MutationOptions = {},
  ) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await mutation.mutateAsync(variables);
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
      runAction(startRoutineTaskMutation, taskInstanceId, options),
    completeRoutineTask: (taskInstanceId: number, options?: MutationOptions) =>
      runAction(completeRoutineTaskMutation, taskInstanceId, options),
    skipRoutineTask: (taskInstanceId: number, options?: MutationOptions) =>
      runAction(skipRoutineTaskMutation, taskInstanceId, options),
    completeChore: (choreInstanceId: number, options?: MutationOptions) =>
      runAction(completeChoreMutation, choreInstanceId, options),
    skipChore: (choreInstanceId: number, options?: MutationOptions) =>
      runAction(skipChoreMutation, choreInstanceId, options),
    rescheduleChoreByOneDay: (
      choreInstanceId: number,
      scheduledDate: string,
      options?: MutationOptions,
    ) =>
      runAction(rescheduleChoreMutation, {
        choreInstanceId,
        scheduledDate: toIsoDate(dayjs(scheduledDate).add(1, "day")),
      }, options),
    takeMedicationDose: (medicationDoseInstanceId: number, options?: MutationOptions) =>
      runAction(takeMedicationDoseMutation, medicationDoseInstanceId, options),
    skipMedicationDose: (medicationDoseInstanceId: number, options?: MutationOptions) =>
      runAction(skipMedicationDoseMutation, medicationDoseInstanceId, options),
    togglePlannedItem: (item: PlannedTodayItem, isDone: boolean, options?: MutationOptions) =>
      runAction(updatePlannedItemMutation, {
        plannedItemId: item.id,
        input: buildPlannedItemPayload(item, isDone),
        scope: "this",
      }, options),
    deletePlannedItem: (
      plannedItemId: number,
      scope: PlannedItemDeleteScope = "this",
      options?: MutationOptions,
    ) => runAction(deletePlannedItemMutation, { plannedItemId, scope }, options),
    createPlannedItem: (title: string, plannedFor: string, options?: MutationOptions) =>
      runAction(createPlannedItemMutation, { title, plannedFor }, options),
    editPlannedItem: (
      item: PlannedTodayItem,
      updates: {
        title: string;
        planned_for: string;
        time_of_day?: string | null;
        duration_minutes?: number | null;
        notes?: string | null;
        module_key?: PlannedItemModuleKey | null;
        recurrence_hint?: string | null;
        rrule?: string | null;
        linked_source?: string | null;
        linked_ref?: string | null;
      },
      scope: PlannedItemEditScope = "this",
      options?: MutationOptions,
    ) =>
      runAction(updatePlannedItemMutation, {
        plannedItemId: item.id,
        input: {
          ...updates,
          is_done: item.is_done,
        },
        scope,
      }, options),
  };
}
