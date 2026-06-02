import type { CalendarEvent } from "@schedule-x/calendar";
import dayjs from "dayjs";
import type { UnifiedDayItem } from "@/lib/api/today";

export const CALENDAR_COLORS = {
  routine: "#0d6efd",
  chore: "#ffc107",
  medication: "#0dcaf0",
  planned: "#6f42c1",
} as const satisfies Record<UnifiedDayItem["item_type"], string>;

const DEFAULT_DURATION_MINUTES = 30;

export function mapToScheduleXEvents(items: UnifiedDayItem[]): CalendarEvent[] {
  return items.flatMap((item) => {
    const start = item.scheduled_at ? dayjs(item.scheduled_at) : null;
    const dateStr = start ? start.format("YYYY-MM-DD HH:mm") : item.scheduled_date;

    if (!dateStr) return [];

    const endStr = start
      ? start.add(item.duration_minutes ?? DEFAULT_DURATION_MINUTES, "minute").format("YYYY-MM-DD HH:mm")
      : dateStr;

    return [{
      id: `${item.item_type}-${item.item_id}`,
      title: item.title,
      start: dateStr,
      end: endStr,
      calendarId: item.item_type,
      _type: item.item_type,
      _status: item.status,
      _itemId: item.item_id,
      _moduleKey: item.module_key,
      _options: item.item_type === "planned" ? undefined : { disableDND: true },
    }];
  });
}
