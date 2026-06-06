export const queryKeys = {
  today: {
    all: ["today"] as const,
    read: () => [...queryKeys.today.all, "read"] as const,
  },
  calendar: {
    all: ["calendar"] as const,
    month: (year: number, month: number) =>
      [...queryKeys.calendar.all, "month", year, month] as const,
    day: (date: string) => [...queryKeys.calendar.all, "day", date] as const,
    range: (start: string, end: string) =>
      [...queryKeys.calendar.all, "range", start, end] as const,
  },
  shoppingLists: {
    all: ["shopping-lists"] as const,
    list: (status: string) => [...queryKeys.shoppingLists.all, "list", status] as const,
    detail: (listId: number) => [...queryKeys.shoppingLists.all, "detail", listId] as const,
    items: (listId: number) => [...queryKeys.shoppingLists.detail(listId), "items"] as const,
  },
  recurringGroceries: {
    all: ["recurring-groceries"] as const,
    list: () => [...queryKeys.recurringGroceries.all, "list"] as const,
  },
  plannedItems: {
    all: ["planned-items"] as const,
    range: (startDate?: string, endDate?: string) =>
      [...queryKeys.plannedItems.all, "range", startDate ?? null, endDate ?? null] as const,
  },
  medication: {
    all: ["medication"] as const,
    plans: () => [...queryKeys.medication.all, "plans"] as const,
    history: () => [...queryKeys.medication.all, "history"] as const,
  },
  templates: {
    all: ["templates"] as const,
    routines: () => [...queryKeys.templates.all, "routines"] as const,
    chores: () => [...queryKeys.templates.all, "chores"] as const,
  },
  settings: {
    all: ["settings"] as const,
    user: () => [...queryKeys.settings.all, "user"] as const,
    integrationClients: () => [...queryKeys.settings.all, "integration-clients"] as const,
  },
  search: {
    all: ["search"] as const,
    items: (query: string) => [...queryKeys.search.all, "items", query] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    summary: (period: string) => [...queryKeys.analytics.all, "summary", period] as const,
  },
} as const;
