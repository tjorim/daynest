import { http, HttpResponse } from "msw";
import { getMockState, mutateRoutineTemplates, mutateChoreTemplates } from "../data/state";
import { nextTemplateId } from "../data/templates";
import type { RoutineTemplateInput, ChoreTemplateInput } from "@/lib/api/today";

export const templateHandlers = [
  // Routine templates
  http.get("/api/v1/templates/routines", () =>
    HttpResponse.json(getMockState().routineTemplates),
  ),

  http.post("/api/v1/templates/routines", async ({ request }) => {
    const input = (await request.json()) as RoutineTemplateInput;
    const newTemplate = {
      id: nextTemplateId(),
      name: input.name,
      description: input.description ?? null,
      start_date: input.start_date,
      every_n_days: input.every_n_days,
      due_time: input.due_time ?? null,
      is_active: input.is_active,
      created_at: new Date().toISOString(),
    };
    mutateRoutineTemplates((ts) => [...ts, newTemplate]);
    return HttpResponse.json(newTemplate, { status: 201 });
  }),

  http.put("/api/v1/templates/routines/:id", async ({ params, request }) => {
    const id = Number(params.id);
    const input = (await request.json()) as RoutineTemplateInput;
    const { routineTemplates } = getMockState();
    const existing = routineTemplates.find((t) => t.id === id);

    if (!existing) {
      return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    }

    const updated = { ...existing, ...input, description: input.description ?? null, due_time: input.due_time ?? null };
    mutateRoutineTemplates((ts) => ts.map((t) => (t.id === id ? updated : t)));
    return HttpResponse.json(updated);
  }),

  http.delete("/api/v1/templates/routines/:id", ({ params }) => {
    const id = Number(params.id);
    mutateRoutineTemplates((ts) => ts.filter((t) => t.id !== id));
    return new HttpResponse(null, { status: 204 });
  }),

  // Chore templates
  http.get("/api/v1/templates/chores", () =>
    HttpResponse.json(getMockState().choreTemplates),
  ),

  http.post("/api/v1/templates/chores", async ({ request }) => {
    const input = (await request.json()) as ChoreTemplateInput;
    const newTemplate = {
      id: nextTemplateId(),
      name: input.name,
      description: input.description ?? null,
      start_date: input.start_date,
      every_n_days: input.every_n_days,
      is_active: input.is_active,
      created_at: new Date().toISOString(),
    };
    mutateChoreTemplates((ts) => [...ts, newTemplate]);
    return HttpResponse.json(newTemplate, { status: 201 });
  }),

  http.put("/api/v1/templates/chores/:id", async ({ params, request }) => {
    const id = Number(params.id);
    const input = (await request.json()) as ChoreTemplateInput;
    const { choreTemplates } = getMockState();
    const existing = choreTemplates.find((t) => t.id === id);

    if (!existing) {
      return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    }

    const updated = { ...existing, ...input, description: input.description ?? null };
    mutateChoreTemplates((ts) => ts.map((t) => (t.id === id ? updated : t)));
    return HttpResponse.json(updated);
  }),

  http.delete("/api/v1/templates/chores/:id", ({ params }) => {
    const id = Number(params.id);
    mutateChoreTemplates((ts) => ts.filter((t) => t.id !== id));
    return new HttpResponse(null, { status: 204 });
  }),
];
