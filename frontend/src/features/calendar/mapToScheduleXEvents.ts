import type { CalendarEvent } from "@schedule-x/calendar";
import dayjs from "dayjs";
import { Temporal } from "temporal-polyfill";
import type { UnifiedDayItem } from "@/lib/api/today";

export const CALENDAR_COLORS = {
  routine: "#0d6efd",
  chore: "#ffc107",
  medication: "#0dcaf0",
  planned: "#6f42c1",
} as const satisfies Record<UnifiedDayItem["item_type"], string>;

const DEFAULT_DURATION_MINUTES = 30;

function toZonedDateTime(value: dayjs.Dayjs): Temporal.ZonedDateTime {
  return Temporal.PlainDateTime.from(value.format("YYYY-MM-DDTHH:mm")).toZonedDateTime(
    Temporal.Now.timeZoneId(),
  );
}

export function mapToScheduleXEvents(items: UnifiedDayItem[]): CalendarEvent[] {
  return items.flatMap((item) => {
    const start = item.scheduled_at ? dayjs(item.scheduled_at) : null;

    if (!start && !item.scheduled_date) return [];

    const eventStart = start
      ? toZonedDateTime(start)
      : Temporal.PlainDate.from(item.scheduled_date as string);
    const eventEnd = start
      ? toZonedDateTime(start.add(item.duration_minutes ?? DEFAULT_DURATION_MINUTES, "minute"))
      : Temporal.PlainDate.from(item.scheduled_date as string);

    return [{
      id: `${item.item_type}-${item.item_id}`,
      title: item.title,
      start: eventStart,
      end: eventEnd,
      calendarId: item.item_type,
      _type: item.item_type,
      _status: item.status,
      _itemId: item.item_id,
      _moduleKey: item.module_key,
      _options: item.item_type === "planned" ? undefined : { disableDND: true },
    }];
  });
}
