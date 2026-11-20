import { jsonResponse } from "@/mocks/response";
import type { TaskInstanceMutationResponse } from "@/api-schema";
import { http } from "msw/http";
import { MOCK_TODAY } from "../data/constants";

export const taskHandlers = [
  http.post("/api/tasks/:id/start", ({ params }) =>
    jsonResponse<TaskInstanceMutationResponse>({
      task_instance_id: Number(params.id),
      status: "in_progress",
      scheduled_date: MOCK_TODAY,
      due_at: null,
      completed_at: null,
    }),
  ),

  http.post("/api/tasks/:id/complete", ({ params }) =>
    jsonResponse<TaskInstanceMutationResponse>({
      task_instance_id: Number(params.id),
      status: "completed",
      scheduled_date: MOCK_TODAY,
      due_at: null,
      completed_at: `${MOCK_TODAY}T09:00:00.000Z`,
    }),
  ),

  http.post("/api/tasks/:id/skip", ({ params }) =>
    jsonResponse<TaskInstanceMutationResponse>({
      task_instance_id: Number(params.id),
      status: "skipped",
      scheduled_date: MOCK_TODAY,
      due_at: null,
      completed_at: null,
    }),
  ),
];
