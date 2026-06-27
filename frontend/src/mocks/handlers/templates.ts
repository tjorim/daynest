import { http, HttpResponse } from "msw";
import { getMockState, mutateRoutineTemplates, mutateChoreTemplates } from "../data/state";
import { nextTemplateId } from "../data/templates";
import { MOCK_TODAY } from "../data/constants";
import type { RoutineTemplateInput, ChoreTemplateInput } from "@/lib/api/templates";

export const templateHandlers = [
  // Routine templates
  http.get("/api/templates/routines", () =>
    HttpResponse.json(getMockState().routineTemplates),
  ),

  http.post("/api/templates/routines", async ({ request }) => {
    const input = (await request.json()) as RoutineTemplateInput;
    const newTemplate = {
      id: nextTemplateId(),
      name: input.name,
      description: input.description ?? null,
      start_date: input.start_date,
      every_n_days: input.every_n_days,
      due_time: input.due_time ?? null,
      is_active: input.is_active,
      created_at: `${MOCK_TODAY}T00:00:00.000Z`,
    };
    mutateRoutineTemplates((ts) => [...ts, newTemplate]);
    return HttpResponse.json(newTemplate, { status: 201 });
  }),

  http.put("/api/templates/routines/:id", async ({ params, request }) => {
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

  http.delete("/api/templates/routines/:id", ({ params }) => {
    const id = Number(params.id);
    mutateRoutineTemplates((ts) => ts.filter((t) => t.id !== id));
    return new HttpResponse(null, { status: 204 });
  }),

  // Chore templates
  http.get("/api/templates/chores", () =>
    HttpResponse.json(getMockState().choreTemplates),
  ),

  http.post("/api/templates/chores", async ({ request }) => {
    const input = (await request.json()) as ChoreTemplateInput;
    const newTemplate = {
      id: nextTemplateId(),
      name: input.name,
      description: input.description ?? null,
      start_date: input.start_date,
      every_n_days: input.every_n_days,
      is_active: input.is_active,
      created_at: `${MOCK_TODAY}T00:00:00.000Z`,
    };
    mutateChoreTemplates((ts) => [...ts, newTemplate]);
    return HttpResponse.json(newTemplate, { status: 201 });
  }),

  http.put("/api/templates/chores/:id", async ({ params, request }) => {
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

  http.delete("/api/templates/chores/:id", ({ params }) => {
    const id = Number(params.id);
    mutateChoreTemplates((ts) => ts.filter((t) => t.id !== id));
    return new HttpResponse(null, { status: 204 });
  }),
];
