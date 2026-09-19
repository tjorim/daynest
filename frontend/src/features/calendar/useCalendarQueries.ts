import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { dayjs, toIsoDate } from "@/lib/dateUtils";

/**
 * Single source of truth for resolving the calendar's selected date from the
 * `date` search param — shared by the route loader (to prefetch the right
 * day) and CalendarPage (to render it), so the two can never diverge.
 */
export function resolveCalendarSelectedDate(searchDate?: string): string {
  if (searchDate) {
    const parsed = dayjs(searchDate);
    if (parsed.isValid() && parsed.format("YYYY-MM-DD") === searchDate) {
      return toIsoDate(parsed);
    }
  }
  return toIsoDate(dayjs());
}

export function calendarDayQueryOptions(date: string) {
  return queryOptions({
    queryKey: queryKeys.calendar.day(date),
    queryFn: ({ signal }) => fetchCalendarDay(date, signal),
    staleTime: 30_000,
  });
}

export function calendarPlannedItemsQueryOptions(date: string) {
  return queryOptions({
    queryKey: queryKeys.plannedItems.range(date, date),
    queryFn: ({ signal }) => listPlannedItems(date, date, signal),
  });
}

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
  return useQuery(calendarDayQueryOptions(date));
}

export function useCalendarPlannedItemsQuery(date: string) {
  return useQuery(calendarPlannedItemsQueryOptions(date));
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
    mutationFn: ({
      choreInstanceId,
      scheduledDate,
    }: {
      choreInstanceId: number;
      scheduledDate: string;
    }) => rescheduleChore(choreInstanceId, scheduledDate),
    onSuccess: invalidate,
  });
}
