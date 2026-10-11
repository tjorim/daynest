import dayjs from "dayjs";
import { getLocale } from "@/paraglide/runtime";

export { dayjs };

const toDate = (value: dayjs.ConfigType): Date => dayjs(value).toDate();

const intl = (options: Intl.DateTimeFormatOptions, value: dayjs.ConfigType): string =>
  new Intl.DateTimeFormat(getLocale(), options).format(toDate(value));

export const toIsoDate = (value: dayjs.ConfigType): string => dayjs(value).format("YYYY-MM-DD");
export const formatTime = (value: dayjs.ConfigType): string => dayjs(value).format("HH:mm");
export const formatDate = (value: dayjs.ConfigType): string =>
  intl({ month: "short", day: "numeric" }, value);
export const formatWeekday = (value: dayjs.ConfigType, width: "short" | "long" = "short"): string =>
  intl({ weekday: width }, value);
export const formatMonthYear = (value: dayjs.ConfigType): string =>
  intl({ month: "long", year: "numeric" }, value);
export const formatDateTime = (value: dayjs.ConfigType): string =>
  intl(
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
    value,
  );
export const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
