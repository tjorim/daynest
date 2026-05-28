import { http, HttpResponse } from "msw";
import { MOCK_TODAY } from "../data/constants";

export const taskHandlers = [
  http.post("/api/v1/tasks/:id/start", ({ params }) =>
    HttpResponse.json({
      task_instance_id: Number(params.id),
      status: "in_progress",
      scheduled_date: MOCK_TODAY,
      due_at: null,
      completed_at: null,
    }),
  ),

  http.post("/api/v1/tasks/:id/complete", ({ params }) =>
    HttpResponse.json({
      task_instance_id: Number(params.id),
      status: "completed",
      scheduled_date: MOCK_TODAY,
      due_at: null,
      completed_at: new Date().toISOString(),
    }),
  ),

  http.post("/api/v1/tasks/:id/skip", ({ params }) =>
    HttpResponse.json({
      task_instance_id: Number(params.id),
      status: "skipped",
      scheduled_date: MOCK_TODAY,
      due_at: null,
      completed_at: null,
    }),
  ),
];
