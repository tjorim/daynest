import {
  createPlannedItem,
  deletePlannedItem,
  listPlannedItems,
  updatePlannedItem,
  type PlannedTodayItem,
} from "@/lib/api/today";

export type RecurringGroceryInput = {
  title: string;
  planned_for: string;
  notes?: string | null;
  rrule: string;
  recurrence_hint?: string | null;
  auto_add_to_list_id?: number | null;
  tags?: string[];
};

export interface RecurringGrocerySeries {
  key: string;
  representative: PlannedTodayItem;
  title: string;
  startDate: string;
  notes: string | null;
  rrule: string;
  recurrenceHint: string | null;
  autoAddToListId: number | null;
  tags: string[];
}

function getSeriesKey(item: PlannedTodayItem): string {
  return item.recurrence_series_id ?? `item-${item.id}`;
}

function toSeries(item: PlannedTodayItem): RecurringGrocerySeries {
  return {
    key: getSeriesKey(item),
    representative: item,
    title: item.title,
    startDate: item.planned_for,
    notes: item.notes,
    rrule: item.rrule ?? "",
    recurrenceHint: item.recurrence_hint,
    autoAddToListId: item.auto_add_to_list_id ?? null,
    tags: item.tags ?? [],
  };
}

export async function listRecurringGroceries(signal?: AbortSignal): Promise<RecurringGrocerySeries[]> {
  const items = await listPlannedItems(undefined, undefined, signal);
  const grouped = new Map<string, PlannedTodayItem>();

  for (const item of items) {
    if (item.module_key !== "recurring_grocery" || !item.rrule) continue;
    const key = getSeriesKey(item);
    const existing = grouped.get(key);
    if (!existing || item.planned_for < existing.planned_for) {
      grouped.set(key, item);
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.title.localeCompare(b.title) || a.planned_for.localeCompare(b.planned_for))
    .map(toSeries);
}

export async function createRecurringGrocery(input: RecurringGroceryInput): Promise<PlannedTodayItem> {
  return createPlannedItem({
    title: input.title,
    planned_for: input.planned_for,
    notes: input.notes ?? null,
    module_key: "recurring_grocery",
    recurrence_hint: input.recurrence_hint ?? null,
    rrule: input.rrule,
    linked_source: "recurring_grocery",
    linked_ref: input.auto_add_to_list_id ? String(input.auto_add_to_list_id) : null,
    auto_add_to_list_id: input.auto_add_to_list_id ?? null,
    tags: input.tags ?? [],
  });
}

export async function updateRecurringGrocery(
  series: RecurringGrocerySeries,
  input: RecurringGroceryInput,
): Promise<PlannedTodayItem> {
  return updatePlannedItem(
    series.representative.id,
    {
      title: input.title,
      planned_for: input.planned_for,
      notes: input.notes ?? null,
      time_of_day: series.representative.time_of_day,
      duration_minutes: series.representative.duration_minutes,
      module_key: "recurring_grocery",
      recurrence_hint: input.recurrence_hint ?? null,
      rrule: input.rrule,
      linked_source: "recurring_grocery",
      linked_ref: input.auto_add_to_list_id ? String(input.auto_add_to_list_id) : null,
      auto_add_to_list_id: input.auto_add_to_list_id ?? null,
      priority: series.representative.priority ?? "normal",
      tags: input.tags ?? [],
      is_done: series.representative.is_done,
    },
    "all",
  );
}

export async function deleteRecurringGrocery(series: RecurringGrocerySeries): Promise<void> {
  return deletePlannedItem(series.representative.id, "future");
}
