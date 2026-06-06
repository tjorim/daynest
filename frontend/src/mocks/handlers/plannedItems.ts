import { http, HttpResponse } from "msw";
import { getMockState, mutatePlannedItems } from "../data/state";
import { nextPlannedItemId } from "../data/plannedItems";
import type { PlannedItemInput, PlannedItemUpdateInput } from "@/lib/api/today";

export const plannedItemHandlers = [
  http.get("/api/planned-items", ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    let { plannedItems } = getMockState();

    if (startDate) {
      plannedItems = plannedItems.filter((i) => i.planned_for >= startDate);
    }
    if (endDate) {
      plannedItems = plannedItems.filter((i) => i.planned_for <= endDate);
    }

    return HttpResponse.json(plannedItems);
  }),

  http.post("/api/planned-items", async ({ request }) => {
    const input = (await request.json()) as PlannedItemInput;
    const newItem = {
      id: nextPlannedItemId(),
      title: input.title,
      planned_for: input.planned_for,
      time_of_day: input.time_of_day ?? null,
      duration_minutes: input.duration_minutes ?? null,
      notes: input.notes ?? null,
      module_key: input.module_key ?? null,
      recurrence_hint: input.recurrence_hint ?? null,
      rrule: input.rrule ?? null,
      recurrence_series_id: null,
      linked_source: input.linked_source ?? null,
      linked_ref: input.linked_ref ?? null,
      auto_add_to_list_id: input.auto_add_to_list_id ?? null,
      priority: input.priority ?? "normal",
      tags: input.tags ?? [],
      is_done: false,
    };
    mutatePlannedItems((items) => [...items, newItem]);
    return HttpResponse.json(newItem, { status: 201 });
  }),

  http.put("/api/planned-items/:id", async ({ params, request }) => {
    const id = Number(params.id);
    const input = (await request.json()) as PlannedItemUpdateInput;
    const { plannedItems } = getMockState();
    const existing = plannedItems.find((i) => i.id === id);

    if (!existing) {
      return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    }

    const updated = { ...existing, ...input };
    mutatePlannedItems((items) => items.map((i) => (i.id === id ? updated : i)));
    return HttpResponse.json(updated);
  }),

  http.delete("/api/planned-items/:id", ({ params }) => {
    const id = Number(params.id);
    mutatePlannedItems((items) => items.filter((i) => i.id !== id));
    return new HttpResponse(null, { status: 204 });
  }),
];
