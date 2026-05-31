import { http, HttpResponse } from "msw";
import { getMockState, mutateMedications } from "../data/state";
import { nextMedicationId, seedMedicationHistory } from "../data/medication";
import { MOCK_TODAY } from "../data/constants";
import type { MedicationPlanInput, MedicationPlanUpdateInput } from "@/lib/api/today";

export const medicationHandlers = [
  http.get("/api/medications", () =>
    HttpResponse.json(getMockState().medications),
  ),

  http.post("/api/medications", async ({ request }) => {
    const input = (await request.json()) as MedicationPlanInput;
    const newPlan = {
      id: nextMedicationId(),
      name: input.name,
      instructions: input.instructions,
      start_date: input.start_date,
      schedule_time: input.schedule_time,
      every_n_days: input.every_n_days,
      is_active: true,
    };
    mutateMedications((plans) => [...plans, newPlan]);
    return HttpResponse.json(newPlan, { status: 201 });
  }),

  http.put("/api/medications/:id", async ({ params, request }) => {
    const id = Number(params.id);
    const input = (await request.json()) as MedicationPlanUpdateInput;
    const { medications } = getMockState();
    const existing = medications.find((m) => m.id === id);

    if (!existing) {
      return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    }

    const updated = { ...existing, ...input };
    mutateMedications((plans) => plans.map((m) => (m.id === id ? updated : m)));
    return HttpResponse.json(updated);
  }),

  http.delete("/api/medications/:id", ({ params }) => {
    const id = Number(params.id);
    mutateMedications((plans) => plans.filter((m) => m.id !== id));
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/medication-doses/:id/take", ({ params }) =>
    HttpResponse.json({
      medication_dose_instance_id: Number(params.id),
      status: "taken",
      scheduled_date: MOCK_TODAY,
    }),
  ),

  http.post("/api/medication-doses/:id/skip", ({ params }) =>
    HttpResponse.json({
      medication_dose_instance_id: Number(params.id),
      status: "skipped",
      scheduled_date: MOCK_TODAY,
    }),
  ),

  http.get("/api/medication-doses/history", () =>
    HttpResponse.json({ history: seedMedicationHistory() }),
  ),
];
