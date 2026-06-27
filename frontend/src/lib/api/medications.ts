import { fetchWithAuth, getJson, parseJsonResponse, sendJson } from "@/lib/api/http";
import { z } from "zod";

export type MedicationDoseStatus = "scheduled" | "taken" | "skipped" | "missed";

export interface MedicationTodayItem {
  medication_dose_instance_id: number;
  medication_plan_id: number;
  name: string;
  instructions: string;
  scheduled_at: string;
  status: MedicationDoseStatus;
}

export type MedicationHistoryItem = MedicationTodayItem;

export interface MedicationMutationResponse {
  medication_dose_instance_id: number;
  status: MedicationDoseStatus;
  scheduled_date: string;
}

export interface MedicationPlan {
  id: number;
  name: string;
  instructions: string;
  start_date: string;
  schedule_time: string;
  every_n_days: number;
  is_active: boolean;
}

export interface MedicationPlanInput {
  name: string;
  instructions: string;
  start_date: string;
  schedule_time: string;
  every_n_days: number;
}

export interface MedicationPlanUpdateInput extends MedicationPlanInput {
  is_active: boolean;
}

export interface MedicationHistoryResponse {
  history: MedicationHistoryItem[];
}

export const medicationDoseStatusSchema = z.enum(["scheduled", "taken", "skipped", "missed"]);

export const medicationTodayItemSchema = z.object({
  medication_dose_instance_id: z.number(),
  medication_plan_id: z.number(),
  name: z.string(),
  instructions: z.string(),
  scheduled_at: z.string(),
  status: medicationDoseStatusSchema,
});

export const medicationHistoryItemSchema = medicationTodayItemSchema;

export const medicationMutationResponseSchema = z.object({
  medication_dose_instance_id: z.number(),
  status: medicationDoseStatusSchema,
  scheduled_date: z.string(),
});

const medicationPlanSchema = z.object({
  id: z.number(),
  name: z.string(),
  instructions: z.string(),
  start_date: z.string(),
  schedule_time: z.string(),
  every_n_days: z.number(),
  is_active: z.boolean(),
});

const medicationHistoryResponseSchema = z.object({
  history: z.array(medicationHistoryItemSchema),
});

export async function listMedicationPlans(signal?: AbortSignal): Promise<MedicationPlan[]> {
  return getJson("/api/medications", z.array(medicationPlanSchema), signal);
}

export async function createMedicationPlan(input: MedicationPlanInput): Promise<MedicationPlan> {
  return sendJson("POST", "/api/medications", input, medicationPlanSchema);
}

export async function updateMedicationPlan(
  medicationPlanId: number,
  input: MedicationPlanUpdateInput,
): Promise<MedicationPlan> {
  return sendJson("PUT", `/api/medications/${medicationPlanId}`, input, medicationPlanSchema);
}

export async function deleteMedicationPlan(medicationPlanId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/medications/${medicationPlanId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // Error-only parse; successful deletes return 204 with no JSON body.
    await parseJsonResponse<never>(response, "Request failed", false);
  }
}

export async function fetchMedicationHistory(
  signal?: AbortSignal,
): Promise<MedicationHistoryItem[]> {
  const payload = await getJson("/api/medication-doses/history", medicationHistoryResponseSchema, signal);
  return payload.history;
}
