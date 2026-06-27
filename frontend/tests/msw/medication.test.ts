import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { listMedicationPlans, createMedicationPlan } from "@/lib/api/medications";
import { seedMedications } from "@/mocks/data/medication";

describe("listMedicationPlans — MSW-backed", () => {
  it("returns medication plans from MSW seed data", async () => {
    const plans = await listMedicationPlans();
    const seed = seedMedications();

    expect(plans).toHaveLength(seed.length);
    const first = plans[0];
    expect(first?.name).toBe("Morning vitamin");
    expect(first?.is_active).toBe(true);
  });

  it("returns the newly created plan after POST", async () => {
    const newPlan = await createMedicationPlan({
      name: "New test medication",
      instructions: "Test instructions",
      start_date: "2026-06-01",
      schedule_time: "10:00",
      every_n_days: 1,
    });

    expect(newPlan.name).toBe("New test medication");
    expect(newPlan.is_active).toBe(true);
    expect(typeof newPlan.id).toBe("number");
  });

  it("propagates a 422 validation error from MSW override", async () => {
    server.use(
      http.post("/api/medications", () =>
        HttpResponse.json(
          { detail: [{ loc: ["body", "name"], msg: "Field required", type: "missing" }] },
          { status: 422 },
        ),
      ),
    );

    await expect(
      createMedicationPlan({
        name: "",
        instructions: "",
        start_date: "2026-06-01",
        schedule_time: "10:00",
        every_n_days: 1,
      }),
    ).rejects.toMatchObject({ status: 422, message: expect.stringContaining("Field required") });
  });
});
