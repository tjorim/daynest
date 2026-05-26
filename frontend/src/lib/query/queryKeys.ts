export const queryKeys = {
  today: {
    all: ["today"] as const,
    read: () => [...queryKeys.today.all, "read"] as const,
  },
  calendar: {
    all: ["calendar"] as const,
    month: (year: number, month: number) => [...queryKeys.calendar.all, "month", year, month] as const,
    day: (date: string) => [...queryKeys.calendar.all, "day", date] as const,
  },
  plannedItems: {
    all: ["planned-items"] as const,
    range: (startDate?: string, endDate?: string) =>
      [...queryKeys.plannedItems.all, "range", startDate ?? null, endDate ?? null] as const,
  },
} as const;
