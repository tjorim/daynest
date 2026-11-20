import { fetchWithAuth, getJson, parseJsonResponse, sendJson } from "@/lib/api/http";
import type {
  ChoreTemplate,
  ChoreTemplateInput,
  RoutineTemplate,
  RoutineTemplateInput,
} from "@/api-types";
import * as m from "@/paraglide/messages";

export async function listRoutineTemplates(signal?: AbortSignal): Promise<RoutineTemplate[]> {
  return getJson<RoutineTemplate[]>("/api/templates/routines", signal, 2);
}

export async function createRoutineTemplate(input: RoutineTemplateInput): Promise<RoutineTemplate> {
  return sendJson<RoutineTemplate>("POST", "/api/templates/routines", input);
}

export async function updateRoutineTemplate(
  routineTemplateId: number,
  input: RoutineTemplateInput,
): Promise<RoutineTemplate> {
  return sendJson<RoutineTemplate>("PUT", `/api/templates/routines/${routineTemplateId}`, input);
}

export async function deleteRoutineTemplate(routineTemplateId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/templates/routines/${routineTemplateId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // Error-only parse; successful deletes return 204 with no JSON body.
    await parseJsonResponse<never>(response, m.api_request_failed(), false);
  }
}

export async function listChoreTemplates(signal?: AbortSignal): Promise<ChoreTemplate[]> {
  return getJson<ChoreTemplate[]>("/api/templates/chores", signal, 2);
}

export async function createChoreTemplate(input: ChoreTemplateInput): Promise<ChoreTemplate> {
  return sendJson<ChoreTemplate>("POST", "/api/templates/chores", input);
}

export async function updateChoreTemplate(
  choreTemplateId: number,
  input: ChoreTemplateInput,
): Promise<ChoreTemplate> {
  return sendJson<ChoreTemplate>("PUT", `/api/templates/chores/${choreTemplateId}`, input);
}

export async function deleteChoreTemplate(choreTemplateId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/templates/chores/${choreTemplateId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // Error-only parse; successful deletes return 204 with no JSON body.
    await parseJsonResponse<never>(response, m.api_request_failed(), false);
  }
}
