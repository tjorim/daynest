import { fetchWithAuth, getJson, parseJsonResponse, sendJson } from "@/lib/api/http";
import type {
  MedicationHistoryItem,
  MedicationHistoryResponse,
  MedicationPlan,
  MedicationPlanInput,
  MedicationPlanUpdateInput,
} from "@/api-types";
import * as m from "@/paraglide/messages";

export async function listMedicationPlans(signal?: AbortSignal): Promise<MedicationPlan[]> {
  return getJson<MedicationPlan[]>("/api/medications", signal);
}

export async function createMedicationPlan(input: MedicationPlanInput): Promise<MedicationPlan> {
  return sendJson<MedicationPlan>("POST", "/api/medications", input);
}

export async function updateMedicationPlan(
  medicationPlanId: number,
  input: MedicationPlanUpdateInput,
): Promise<MedicationPlan> {
  return sendJson<MedicationPlan>("PUT", `/api/medications/${medicationPlanId}`, input);
}

export async function deleteMedicationPlan(medicationPlanId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/medications/${medicationPlanId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // Error-only parse; successful deletes return 204 with no JSON body.
    await parseJsonResponse<never>(response, m.api_request_failed(), false);
  }
}

export async function fetchMedicationHistory(
  signal?: AbortSignal,
): Promise<MedicationHistoryItem[]> {
  const payload = await getJson<MedicationHistoryResponse>("/api/medication-doses/history", signal);
  return payload.history;
}
