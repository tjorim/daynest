import { http, HttpResponse } from "msw";
import { MOCK_TODAY } from "../data/constants";

export const choreHandlers = [
  http.post("/api/v1/chores/:id/complete", ({ params }) =>
    HttpResponse.json({
      chore_instance_id: Number(params.id),
      status: "completed",
      scheduled_date: MOCK_TODAY,
      completed_at: `${MOCK_TODAY}T09:00:00.000Z`,
      skipped_at: null,
    }),
  ),

  http.post("/api/v1/chores/:id/skip", ({ params }) =>
    HttpResponse.json({
      chore_instance_id: Number(params.id),
      status: "skipped",
      scheduled_date: MOCK_TODAY,
      completed_at: null,
      skipped_at: `${MOCK_TODAY}T09:00:00.000Z`,
    }),
  ),

  http.post("/api/v1/chores/:id/reschedule", async ({ params, request }) => {
    const body = (await request.json()) as { scheduled_date: string };
    return HttpResponse.json({
      chore_instance_id: Number(params.id),
      status: "pending",
      scheduled_date: body.scheduled_date,
      completed_at: null,
      skipped_at: null,
    });
  }),
];
