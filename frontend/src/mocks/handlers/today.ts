import { http, HttpResponse } from "msw";
import { getMockState, getTodayPayload } from "../data/state";
import { auth401, forbidden403, serverError500 } from "./errors";
import { MOCK_TODAY } from "../data/constants";

export const todayHandlers = [
  http.get("/api/v1/today", () => {
    const { scenario } = getMockState();
    if (scenario === "signed-out" || scenario === "expired-session") return auth401();
    if (scenario === "forbidden") return forbidden403();
    if (scenario === "api-error") return serverError500();
    return HttpResponse.json(getTodayPayload());
  }),

  http.get("/api/v1/calendar/month", ({ request }) => {
    const url = new URL(request.url);
    const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
    const month = Number(url.searchParams.get("month") ?? new Date().getMonth() + 1);

    const days = Array.from({ length: 28 }, (_, i) => {
      const day = i + 1;
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const hasItems = day % 3 !== 0;
      return {
        date,
        total: hasItems ? 3 : 0,
        routines: hasItems ? 1 : 0,
        chores: hasItems ? 1 : 0,
        medications: hasItems ? 1 : 0,
        planned: 0,
      };
    });

    return HttpResponse.json({ year, month, days });
  }),

  http.get("/api/v1/calendar/day", ({ request }) => {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? MOCK_TODAY;
    const payload = getTodayPayload();

    return HttpResponse.json({
      date,
      items: [
        ...payload.routines.map((r) => ({
          item_type: "routine" as const,
          item_id: r.task_instance_id,
          title: r.title,
          status: r.status,
          scheduled_at: r.due_at,
          scheduled_date: r.scheduled_date,
          detail: null,
          module_key: null,
        })),
        ...payload.due_today.map((c) => ({
          item_type: "chore" as const,
          item_id: c.chore_instance_id,
          title: c.title,
          status: c.status,
          scheduled_at: null,
          scheduled_date: c.scheduled_date,
          detail: null,
          module_key: null,
        })),
      ],
    });
  }),
];
