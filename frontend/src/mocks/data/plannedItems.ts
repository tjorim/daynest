import type { PlannedTodayItem } from "@/lib/api/today";

export function seedPlannedItems(date: string): PlannedTodayItem[] {
  return [
    {
      id: 401,
      title: "Order groceries",
      planned_for: date,
      time_of_day: null,
      duration_minutes: 30,
      notes: "Check pantry first",
      module_key: "shopping_list",
      recurrence_hint: null,
      rrule: null,
      recurrence_series_id: null,
      linked_source: null,
      linked_ref: null,
      is_done: false,
    },
    {
      id: 402,
      title: "Call dentist",
      planned_for: date,
      time_of_day: "10:00",
      duration_minutes: 15,
      notes: null,
      module_key: null,
      recurrence_hint: null,
      rrule: null,
      recurrence_series_id: null,
      linked_source: null,
      linked_ref: null,
      is_done: true,
    },
    {
      id: 403,
      title: "Weekly meal plan",
      planned_for: date,
      time_of_day: null,
      duration_minutes: 45,
      notes: null,
      module_key: "meal_planning",
      recurrence_hint: "weekly",
      rrule: "FREQ=WEEKLY;BYDAY=FR",
      recurrence_series_id: "series-001",
      linked_source: null,
      linked_ref: null,
      is_done: false,
    },
  ];
}

let _nextPlannedItemId = 500;

export function nextPlannedItemId(): number {
  return _nextPlannedItemId++;
}

export function resetPlannedItemId(): void {
  _nextPlannedItemId = 500;
}
