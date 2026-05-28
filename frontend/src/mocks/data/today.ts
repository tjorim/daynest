import type { TodayPayload } from "@/lib/api/today";

export function emptyTodayPayload(_date: string): TodayPayload {
  return {
    medication: [],
    medication_history: [],
    routines: [],
    overdue: [],
    due_today: [],
    upcoming: [],
    planned: [],
    day_items: [],
  };
}

export function busyTodayPayload(date: string): TodayPayload {
  return {
    medication: [
      {
        medication_dose_instance_id: 101,
        medication_plan_id: 10,
        name: "Morning vitamin",
        instructions: "With breakfast",
        scheduled_at: `${date}T08:00:00Z`,
        status: "scheduled",
      },
      {
        medication_dose_instance_id: 102,
        medication_plan_id: 11,
        name: "Blood pressure pill",
        instructions: "Before bed",
        scheduled_at: `${date}T22:00:00Z`,
        status: "taken",
      },
      {
        medication_dose_instance_id: 103,
        medication_plan_id: 12,
        name: "Evening magnesium",
        instructions: "After dinner",
        scheduled_at: `${date}T20:00:00Z`,
        status: "skipped",
      },
    ],
    medication_history: [
      {
        medication_dose_instance_id: 90,
        medication_plan_id: 10,
        name: "Morning vitamin",
        instructions: "With breakfast",
        scheduled_at: `2026-05-28T08:00:00Z`,
        status: "taken",
      },
    ],
    routines: [
      {
        task_instance_id: 201,
        routine_template_id: 20,
        title: "Morning stretches",
        status: "completed",
        scheduled_date: date,
        due_at: `${date}T09:00:00Z`,
      },
      {
        task_instance_id: 202,
        routine_template_id: 21,
        title: "Pack lunch",
        status: "pending",
        scheduled_date: date,
        due_at: null,
      },
      {
        task_instance_id: 203,
        routine_template_id: 22,
        title: "Evening walk",
        status: "in_progress",
        scheduled_date: date,
        due_at: `${date}T19:00:00Z`,
      },
    ],
    overdue: [],
    due_today: [
      {
        chore_instance_id: 301,
        chore_template_id: 30,
        title: "Water plants",
        status: "pending",
        scheduled_date: date,
      },
      {
        chore_instance_id: 302,
        chore_template_id: 31,
        title: "Take out recycling",
        status: "completed",
        scheduled_date: date,
      },
    ],
    upcoming: [
      {
        chore_instance_id: 303,
        chore_template_id: 32,
        title: "Clean bathroom",
        scheduled_date: "2026-06-01",
      },
    ],
    planned: [
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
    ],
    day_items: [
      {
        item_type: "routine",
        item_id: 201,
        title: "Morning stretches",
        status: "completed",
        scheduled_at: `${date}T09:00:00Z`,
        scheduled_date: date,
        detail: null,
        module_key: null,
      },
    ],
  };
}

export function medicationRefillTodayPayload(date: string): TodayPayload {
  return {
    medication: [
      {
        medication_dose_instance_id: 120,
        medication_plan_id: 10,
        name: "Morning vitamin",
        instructions: "With breakfast",
        scheduled_at: `${date}T08:00:00Z`,
        status: "scheduled",
      },
      {
        medication_dose_instance_id: 121,
        medication_plan_id: 11,
        name: "Blood pressure pill",
        instructions: "Before bed",
        scheduled_at: `${date}T22:00:00Z`,
        status: "taken",
      },
      {
        medication_dose_instance_id: 122,
        medication_plan_id: 12,
        name: "Evening magnesium",
        instructions: "After dinner — last dose, needs refill",
        scheduled_at: `${date}T20:00:00Z`,
        status: "skipped",
      },
      {
        medication_dose_instance_id: 123,
        medication_plan_id: 14,
        name: "Antihistamine (expired plan)",
        instructions: "Take with water",
        scheduled_at: `${date}T12:00:00Z`,
        status: "missed",
      },
    ],
    medication_history: [
      {
        medication_dose_instance_id: 115,
        medication_plan_id: 12,
        name: "Evening magnesium",
        instructions: "After dinner",
        scheduled_at: "2026-05-28T20:00:00Z",
        status: "missed",
      },
      {
        medication_dose_instance_id: 116,
        medication_plan_id: 12,
        name: "Evening magnesium",
        instructions: "After dinner",
        scheduled_at: "2026-05-27T20:00:00Z",
        status: "missed",
      },
    ],
    routines: [],
    overdue: [],
    due_today: [],
    upcoming: [],
    planned: [],
    day_items: [],
  };
}

export function overdueTodayPayload(date: string): TodayPayload {
  return {
    medication: [
      {
        medication_dose_instance_id: 110,
        medication_plan_id: 10,
        name: "Morning vitamin",
        instructions: "With breakfast",
        scheduled_at: `${date}T08:00:00Z`,
        status: "missed",
      },
      {
        medication_dose_instance_id: 111,
        medication_plan_id: 11,
        name: "Blood pressure pill",
        instructions: "Before bed",
        scheduled_at: `${date}T22:00:00Z`,
        status: "missed",
      },
    ],
    medication_history: [],
    routines: [
      {
        task_instance_id: 210,
        routine_template_id: 20,
        title: "Morning stretches",
        status: "pending",
        scheduled_date: date,
        due_at: `${date}T09:00:00Z`,
      },
    ],
    overdue: [
      {
        chore_instance_id: 310,
        chore_template_id: 30,
        title: "Clean kitchen",
        status: "pending",
        overdue_since: "2026-05-25",
      },
      {
        chore_instance_id: 311,
        chore_template_id: 31,
        title: "Change bed sheets",
        status: "pending",
        overdue_since: "2026-05-20",
      },
    ],
    due_today: [
      {
        chore_instance_id: 312,
        chore_template_id: 32,
        title: "Vacuum living room",
        status: "pending",
        scheduled_date: date,
      },
    ],
    upcoming: [],
    planned: [],
    day_items: [],
  };
}
