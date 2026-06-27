import { fetchWithAuth, parseJsonResponse } from "@/lib/api/http";
import { z } from "zod";

export interface RoutineTemplate {
  id: number;
  name: string;
  description: string | null;
  start_date: string;
  every_n_days: number;
  due_time: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RoutineTemplateInput {
  name: string;
  description?: string | null;
  start_date: string;
  every_n_days: number;
  due_time?: string | null;
  is_active: boolean;
}

export interface ChoreTemplate {
  id: number;
  name: string;
  description: string | null;
  start_date: string;
  every_n_days: number;
  is_active: boolean;
  created_at: string;
}

export interface ChoreTemplateInput {
  name: string;
  description?: string | null;
  start_date: string;
  every_n_days: number;
  is_active: boolean;
}

const routineTemplateSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  start_date: z.string(),
  every_n_days: z.number(),
  due_time: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
});

const choreTemplateSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  start_date: z.string(),
  every_n_days: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export async function listRoutineTemplates(signal?: AbortSignal): Promise<RoutineTemplate[]> {
  const response = await fetchWithAuth("/api/templates/routines", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse(response, "Request failed", true, z.array(routineTemplateSchema));
}

export async function createRoutineTemplate(input: RoutineTemplateInput): Promise<RoutineTemplate> {
  const response = await fetchWithAuth("/api/templates/routines", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response, "Request failed", false, routineTemplateSchema);
}

export async function updateRoutineTemplate(
  routineTemplateId: number,
  input: RoutineTemplateInput,
): Promise<RoutineTemplate> {
  const response = await fetchWithAuth(`/api/templates/routines/${routineTemplateId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response, "Request failed", false, routineTemplateSchema);
}

export async function deleteRoutineTemplate(routineTemplateId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/templates/routines/${routineTemplateId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // Error-only parse; successful deletes return 204 with no JSON body.
    await parseJsonResponse<never>(response, "Request failed", false);
  }
}

export async function listChoreTemplates(signal?: AbortSignal): Promise<ChoreTemplate[]> {
  const response = await fetchWithAuth("/api/templates/chores", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse(response, "Request failed", true, z.array(choreTemplateSchema));
}

export async function createChoreTemplate(input: ChoreTemplateInput): Promise<ChoreTemplate> {
  const response = await fetchWithAuth("/api/templates/chores", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response, "Request failed", false, choreTemplateSchema);
}

export async function updateChoreTemplate(
  choreTemplateId: number,
  input: ChoreTemplateInput,
): Promise<ChoreTemplate> {
  const response = await fetchWithAuth(`/api/templates/chores/${choreTemplateId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response, "Request failed", false, choreTemplateSchema);
}

export async function deleteChoreTemplate(choreTemplateId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/templates/chores/${choreTemplateId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // Error-only parse; successful deletes return 204 with no JSON body.
    await parseJsonResponse<never>(response, "Request failed", false);
  }
}
