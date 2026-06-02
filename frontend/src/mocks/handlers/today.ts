import { http, HttpResponse } from "msw";
import { getMockState, getTodayPayload } from "../data/state";
import { auth401, forbidden403, serverError500 } from "./errors";
import { MOCK_TODAY } from "../data/constants";

export const todayHandlers = [
  http.get("/api/today/stream", () => {
    const stream = new ReadableStream({
      start() {
        // Intentionally empty — keeps the stream alive without emitting events.
        // Override this handler in individual tests to inject specific events.
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }),

  http.get("/api/today", () => {
    const { scenario } = getMockState();
    if (scenario === "signed-out" || scenario === "expired-session") return auth401();
    if (scenario === "forbidden") return forbidden403();
    if (scenario === "api-error") return serverError500();
    return HttpResponse.json(getTodayPayload());
  }),

  http.get("/api/calendar/month", ({ request }) => {
    const url = new URL(request.url);
    const [defaultYear, defaultMonth] = MOCK_TODAY.split("-").map(Number);
    const year = Number(url.searchParams.get("year") ?? defaultYear);
    const month = Number(url.searchParams.get("month") ?? defaultMonth);

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

  http.get("/api/calendar/range", ({ request }) => {
    const url = new URL(request.url);
    const start = url.searchParams.get("start") ?? MOCK_TODAY;
    const end = url.searchParams.get("end") ?? MOCK_TODAY;
    const payload = getTodayPayload();
    return HttpResponse.json({
      items: [
        ...payload.routines
          .filter((r) => r.scheduled_date >= start && r.scheduled_date <= end)
          .map((r) => ({
            item_type: "routine" as const,
            item_id: r.task_instance_id,
            title: r.title,
            status: r.status,
            scheduled_at: r.due_at,
            scheduled_date: r.scheduled_date,
            detail: null,
            module_key: null,
          })),
        ...payload.due_today
          .filter((c) => c.scheduled_date >= start && c.scheduled_date <= end)
          .map((c) => ({
            item_type: "chore" as const,
            item_id: c.chore_instance_id,
            title: c.title,
            status: c.status,
            scheduled_at: null,
            scheduled_date: c.scheduled_date,
            detail: null,
            module_key: null,
          })),
        ...getMockState()
          .plannedItems.filter((item) => item.planned_for >= start && item.planned_for <= end)
          .map((item) => ({
            item_type: "planned" as const,
            item_id: item.id,
            title: item.title,
            status: item.is_done ? "done" : "planned",
            scheduled_at: item.time_of_day ? `${item.planned_for}T${item.time_of_day}` : null,
            scheduled_date: item.planned_for,
            duration_minutes: item.duration_minutes,
            detail: item.notes,
            module_key: item.module_key,
          })),
      ],
    });
  }),

  http.get("/api/calendar/day", ({ request }) => {
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
