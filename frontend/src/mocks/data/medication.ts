import type { MedicationPlan, MedicationHistoryItem } from "@/lib/api/today";

export function seedMedications(): MedicationPlan[] {
  return [
    {
      id: 10,
      name: "Morning vitamin",
      instructions: "With breakfast",
      start_date: "2026-01-01",
      schedule_time: "08:00",
      every_n_days: 1,
      is_active: true,
    },
    {
      id: 11,
      name: "Blood pressure pill",
      instructions: "Before bed",
      start_date: "2026-01-15",
      schedule_time: "22:00",
      every_n_days: 1,
      is_active: true,
    },
    {
      id: 12,
      name: "Evening magnesium",
      instructions: "After dinner",
      start_date: "2026-02-01",
      schedule_time: "20:00",
      every_n_days: 1,
      is_active: true,
    },
    {
      id: 13,
      name: "Vitamin D (inactive)",
      instructions: "With fatty meal",
      start_date: "2026-01-01",
      schedule_time: "12:00",
      every_n_days: 7,
      is_active: false,
    },
  ];
}

export function seedMedicationHistory(): MedicationHistoryItem[] {
  return [
    {
      medication_dose_instance_id: 90,
      medication_plan_id: 10,
      name: "Morning vitamin",
      instructions: "With breakfast",
      scheduled_at: "2026-05-28T08:00:00Z",
      status: "taken",
    },
    {
      medication_dose_instance_id: 91,
      medication_plan_id: 11,
      name: "Blood pressure pill",
      instructions: "Before bed",
      scheduled_at: "2026-05-28T22:00:00Z",
      status: "taken",
    },
    {
      medication_dose_instance_id: 92,
      medication_plan_id: 12,
      name: "Evening magnesium",
      instructions: "After dinner",
      scheduled_at: "2026-05-27T20:00:00Z",
      status: "skipped",
    },
  ];
}

/** Returns a low-stock/refill-needed scenario set of medication plans. */
export function refillMedications(): MedicationPlan[] {
  return seedMedications().map((m) => ({
    ...m,
    is_active: m.id !== 13,
  }));
}

let _nextMedicationId = 100;

export function nextMedicationId(): number {
  return _nextMedicationId++;
}

export function resetMedicationId(): void {
  _nextMedicationId = 100;
}
