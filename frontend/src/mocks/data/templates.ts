import type { RoutineTemplate, ChoreTemplate } from "@/lib/api/templates";

export function seedRoutineTemplates(): RoutineTemplate[] {
  return [
    {
      id: 20,
      name: "Morning routine",
      description: "Stretches and mindfulness",
      start_date: "2026-01-01",
      every_n_days: 1,
      due_time: "09:00",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: 21,
      name: "Pack lunch",
      description: null,
      start_date: "2026-01-01",
      every_n_days: 1,
      due_time: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: 22,
      name: "Evening walk",
      description: "30 minute walk around the block",
      start_date: "2026-01-01",
      every_n_days: 1,
      due_time: "19:00",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: 23,
      name: "Weekly review",
      description: "Review goals and plan next week",
      start_date: "2026-01-05",
      every_n_days: 7,
      due_time: "18:00",
      is_active: true,
      created_at: "2026-01-05T00:00:00Z",
    },
  ];
}

export function seedChoreTemplates(): ChoreTemplate[] {
  return [
    {
      id: 30,
      name: "Water plants",
      description: null,
      start_date: "2026-01-01",
      every_n_days: 2,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: 31,
      name: "Take out recycling",
      description: "Blue bin on Mondays",
      start_date: "2026-01-05",
      every_n_days: 7,
      is_active: true,
      created_at: "2026-01-05T00:00:00Z",
    },
    {
      id: 32,
      name: "Clean bathroom",
      description: null,
      start_date: "2026-01-01",
      every_n_days: 7,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: 33,
      name: "Vacuum living room",
      description: null,
      start_date: "2026-01-01",
      every_n_days: 7,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: 34,
      name: "Clean kitchen",
      description: "Deep clean including oven",
      start_date: "2026-01-01",
      every_n_days: 14,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];
}

/** Extended set used by the template-crud scenario — shows active, inactive, and paginated lists. */
export function seedRoutineTemplatesCrud(): RoutineTemplate[] {
  return [
    ...seedRoutineTemplates(),
    {
      id: 24,
      name: "Journaling",
      description: "Daily reflection before bed",
      start_date: "2026-02-01",
      every_n_days: 1,
      due_time: "21:00",
      is_active: true,
      created_at: "2026-02-01T00:00:00Z",
    },
    {
      id: 25,
      name: "Old yoga routine",
      description: "Replaced by morning stretches",
      start_date: "2025-06-01",
      every_n_days: 1,
      due_time: "07:00",
      is_active: false,
      created_at: "2025-06-01T00:00:00Z",
    },
  ];
}

export function seedChoreTemplatesCrud(): ChoreTemplate[] {
  return [
    ...seedChoreTemplates(),
    {
      id: 35,
      name: "Change bed sheets",
      description: null,
      start_date: "2026-01-01",
      every_n_days: 14,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: 36,
      name: "Defrost freezer",
      description: "Do quarterly",
      start_date: "2026-01-01",
      every_n_days: 90,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: 37,
      name: "Old window cleaning",
      description: null,
      start_date: "2025-01-01",
      every_n_days: 30,
      is_active: false,
      created_at: "2025-01-01T00:00:00Z",
    },
  ];
}

let _nextTemplateId = 200;

export function nextTemplateId(): number {
  return _nextTemplateId++;
}

export function resetTemplateId(): void {
  _nextTemplateId = 200;
}
