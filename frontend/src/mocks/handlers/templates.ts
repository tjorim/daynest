import { http, HttpResponse } from "msw/http";
import { getMockState, mutateRoutineTemplates, mutateChoreTemplates } from "../data/state";
import { nextTemplateId } from "../data/templates";
import { MOCK_TODAY } from "../data/constants";
import type {
  ChoreTemplate,
  ChoreTemplateInput,
  RoutineTemplate,
  RoutineTemplateInput,
} from "@/api-types";

export const templateHandlers = [
  // Routine templates
  http.get("/api/templates/routines", () => HttpResponse.json(getMockState().routineTemplates)),

  http.post("/api/templates/routines", async ({ request }) => {
    const input = (await request.json()) as RoutineTemplateInput;
    const newTemplate: RoutineTemplate = {
      id: nextTemplateId(),
      name: input.name,
      description: input.description ?? null,
      start_date: input.start_date,
      every_n_days: input.every_n_days ?? 1,
      rrule: input.rrule ?? null,
      due_time: input.due_time ?? null,
      is_active: input.is_active ?? true,
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

    const updated: RoutineTemplate = {
      ...existing,
      name: input.name,
      start_date: input.start_date,
      every_n_days: input.every_n_days ?? existing.every_n_days,
      rrule: input.rrule ?? null,
      is_active: input.is_active ?? existing.is_active,
      description: input.description ?? null,
      due_time: input.due_time ?? null,
    };
    mutateRoutineTemplates((ts) => ts.map((t) => (t.id === id ? updated : t)));
    return HttpResponse.json(updated);
  }),

  http.delete("/api/templates/routines/:id", ({ params }) => {
    const id = Number(params.id);
    mutateRoutineTemplates((ts) => ts.filter((t) => t.id !== id));
    return new HttpResponse(null, { status: 204 });
  }),

  // Chore templates
  http.get("/api/templates/chores", () => HttpResponse.json(getMockState().choreTemplates)),

  http.post("/api/templates/chores", async ({ request }) => {
    const input = (await request.json()) as ChoreTemplateInput;
    const newTemplate: ChoreTemplate = {
      id: nextTemplateId(),
      name: input.name,
      description: input.description ?? null,
      start_date: input.start_date,
      every_n_days: input.every_n_days ?? 1,
      rrule: input.rrule ?? null,
      priority: input.priority ?? "normal",
      tags: input.tags ?? [],
      household_id: input.household_id ?? null,
      is_active: input.is_active ?? true,
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

    const updated: ChoreTemplate = {
      ...existing,
      name: input.name,
      start_date: input.start_date,
      every_n_days: input.every_n_days ?? existing.every_n_days,
      rrule: input.rrule ?? null,
      priority: input.priority ?? existing.priority,
      tags: input.tags ?? existing.tags,
      household_id: input.household_id ?? null,
      is_active: input.is_active ?? existing.is_active,
      description: input.description ?? null,
    };
    mutateChoreTemplates((ts) => ts.map((t) => (t.id === id ? updated : t)));
    return HttpResponse.json(updated);
  }),

  http.delete("/api/templates/chores/:id", ({ params }) => {
    const id = Number(params.id);
    mutateChoreTemplates((ts) => ts.filter((t) => t.id !== id));
    return new HttpResponse(null, { status: 204 });
  }),
];
