import type {
  ChoreMutationResponse,
  MedicationMutationResponse,
  TaskMutationResponse,
} from "@/api-types";
import { seedPlannedItems } from "@/mocks/data/plannedItems";
import { seedUserSettings } from "@/mocks/data/settings";

export const plannedItemFixture = seedPlannedItems("2026-05-16")[0]!;
export const settingsFixture = {
  ...seedUserSettings(),
  timezone: "UTC",
  quiet_hours_start: null,
  quiet_hours_end: null,
};
export const taskMutationFixture: TaskMutationResponse = {
  task_instance_id: 1,
  status: "completed",
  scheduled_date: "2026-05-16",
  due_at: null,
  completed_at: null,
};
export const choreMutationFixture: ChoreMutationResponse = {
  chore_instance_id: 1,
  status: "completed",
  scheduled_date: "2026-05-16",
  completed_at: null,
  skipped_at: null,
  assigned_to: null,
  completed_by: null,
};
export const medicationMutationFixture: MedicationMutationResponse = {
  medication_dose_instance_id: 1,
  status: "taken",
  scheduled_date: "2026-05-16",
};
