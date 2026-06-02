import { useQuery } from "@tanstack/react-query";
import { fetchCalendarRange } from "@/lib/api/today";
import { queryKeys } from "@/lib/query/queryKeys";

export interface CalendarRangeParams {
  start: string;
  end: string;
}

export function useCalendarRangeQuery({ start, end }: CalendarRangeParams) {
  return useQuery({
    queryKey: queryKeys.calendar.range(start, end),
    queryFn: ({ signal }) => fetchCalendarRange(start, end, signal),
  });
}
