import { dayjs } from "@/lib/dateUtils";

export type RepeatPreset = "daily" | "weekly" | "monthly" | "custom";

const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export function selectedDateWeekdayCode(selectedDate: string): string {
  return WEEKDAY_CODES[dayjs(selectedDate).day()] ?? "MO";
}

export function parseRRule(
  rrule: string,
  fallbackWeekday: string,
): { preset: RepeatPreset; weekdays: string[]; customInterval: number } {
  const parts = new Map(
    rrule
      .split(";")
      .map((part) => part.split("=", 2))
      .filter((entry): entry is [string, string] => entry.length === 2),
  );
  const freq = (parts.get("FREQ") ?? "").toUpperCase();
  const interval = Number(parts.get("INTERVAL") ?? "1");

  if (freq === "WEEKLY") {
    const weekdays = (parts.get("BYDAY") ?? fallbackWeekday)
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    return { preset: "weekly", weekdays, customInterval: 2 };
  }
  if (freq === "MONTHLY") {
    return { preset: "monthly", weekdays: [fallbackWeekday], customInterval: 2 };
  }
  if (freq === "DAILY" && interval > 1) {
    return { preset: "custom", weekdays: [fallbackWeekday], customInterval: interval };
  }

  return { preset: "daily", weekdays: [fallbackWeekday], customInterval: 2 };
}

export function buildRRule(
  preset: RepeatPreset,
  weekdays: string[],
  customInterval: number,
  fallbackDate: string,
): string {
  if (preset === "daily") return "FREQ=DAILY";
  if (preset === "weekly") {
    const selectedWeekdays = weekdays.length ? weekdays : [selectedDateWeekdayCode(fallbackDate)];
    return `FREQ=WEEKLY;BYDAY=${selectedWeekdays.join(",")}`;
  }
  if (preset === "monthly") return "FREQ=MONTHLY";
  const interval = isNaN(customInterval) ? 2 : Math.max(2, customInterval);
  return `FREQ=DAILY;INTERVAL=${interval}`;
}
