import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeChore,
  completeRoutineTask,
  fetchCalendarDay,
  fetchCalendarMonth,
  listPlannedItems,
  rescheduleChore,
  skipChore,
  skipRoutineTask,
  startRoutineTask,
} from "@/lib/api/today";
import { queryKeys } from "@/lib/query/queryKeys";

function useInvalidateCalendarQueries() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.today.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    ]);
}

export function useCalendarMonthQuery(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.calendar.month(year, month),
    queryFn: ({ signal }) => fetchCalendarMonth(year, month, signal),
  });
}

export function useCalendarDayQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.calendar.day(date),
    queryFn: ({ signal }) => fetchCalendarDay(date, signal),
  });
}

export function useCalendarPlannedItemsQuery(date: string) {
  return useQuery({
    queryKey: queryKeys.plannedItems.range(date, date),
    queryFn: ({ signal }) => listPlannedItems(date, date, signal),
  });
}

export function useStartRoutineTaskMutation() {
  const invalidate = useInvalidateCalendarQueries();
  return useMutation({
    mutationFn: (taskInstanceId: number) => startRoutineTask(taskInstanceId),
    onSuccess: invalidate,
  });
}

export function useCompleteRoutineTaskMutation() {
  const invalidate = useInvalidateCalendarQueries();
  return useMutation({
    mutationFn: (taskInstanceId: number) => completeRoutineTask(taskInstanceId),
    onSuccess: invalidate,
  });
}

export function useSkipRoutineTaskMutation() {
  const invalidate = useInvalidateCalendarQueries();
  return useMutation({
    mutationFn: (taskInstanceId: number) => skipRoutineTask(taskInstanceId),
    onSuccess: invalidate,
  });
}

export function useCompleteChoreMutation() {
  const invalidate = useInvalidateCalendarQueries();
  return useMutation({
    mutationFn: (choreInstanceId: number) => completeChore(choreInstanceId),
    onSuccess: invalidate,
  });
}

export function useSkipChoreMutation() {
  const invalidate = useInvalidateCalendarQueries();
  return useMutation({
    mutationFn: (choreInstanceId: number) => skipChore(choreInstanceId),
    onSuccess: invalidate,
  });
}

export function useRescheduleChoreMutation() {
  const invalidate = useInvalidateCalendarQueries();
  return useMutation({
    mutationFn: ({ choreInstanceId, scheduledDate }: { choreInstanceId: number; scheduledDate: string }) =>
      rescheduleChore(choreInstanceId, scheduledDate),
    onSuccess: invalidate,
  });
}
