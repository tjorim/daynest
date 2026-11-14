import { http, HttpResponse } from "msw/http";
import { getMockState, mutateSettings } from "../data/state";
import type { UserSettingsPatch } from "@/api-types";

let mockCalendarFeedToken = "mock-calendar-feed-token";

export const settingsHandlers = [
  http.get("/api/users/me/settings", () => HttpResponse.json(getMockState().settings)),

  http.patch("/api/users/me/settings", async ({ request }) => {
    const patch = (await request.json()) as UserSettingsPatch;
    mutateSettings((s) => ({
      ...s,
      timezone: patch.timezone ?? s.timezone,
      default_snooze_days: patch.default_snooze_days ?? s.default_snooze_days,
      medication_reminder_minutes:
        patch.medication_reminder_minutes ?? s.medication_reminder_minutes,
      quiet_hours_start:
        patch.quiet_hours_start === undefined ? s.quiet_hours_start : patch.quiet_hours_start,
      quiet_hours_end:
        patch.quiet_hours_end === undefined ? s.quiet_hours_end : patch.quiet_hours_end,
      push_overdue_chores_enabled:
        patch.push_overdue_chores_enabled ?? s.push_overdue_chores_enabled,
      push_medication_reminders_enabled:
        patch.push_medication_reminders_enabled ?? s.push_medication_reminders_enabled,
      push_missed_medications_enabled:
        patch.push_missed_medications_enabled ?? s.push_missed_medications_enabled,
    }));
    return HttpResponse.json(getMockState().settings);
  }),

  http.get("/api/calendar/feed", () =>
    HttpResponse.json({
      token: mockCalendarFeedToken,
      feed_url: `http://localhost/api/calendar/feed/${mockCalendarFeedToken}.ics`,
    }),
  ),

  http.post("/api/calendar/feed/regenerate", () => {
    mockCalendarFeedToken = `mock-calendar-feed-token-${Date.now()}`;
    return HttpResponse.json({
      token: mockCalendarFeedToken,
      feed_url: `http://localhost/api/calendar/feed/${mockCalendarFeedToken}.ics`,
    });
  }),

  http.get("/api/integrations/clients", () =>
    HttpResponse.json([
      {
        id: 1,
        name: "Home Assistant",
        rate_limit_per_minute: 60,
        is_active: true,
      },
    ]),
  ),

  http.post("/api/integrations/clients", async ({ request }) => {
    const body = (await request.json()) as { name: string; rate_limit_per_minute: number };
    return HttpResponse.json(
      {
        id: 99,
        name: body.name,
        rate_limit_per_minute: body.rate_limit_per_minute,
        is_active: true,
        api_key: "mock-api-key-new",
        client_id: "mock-client-id-new",
        client_secret: "mock-client-secret-new",
        token_url: "http://localhost/mock-issuer/token",
      },
      { status: 201 },
    );
  }),

  http.post("/api/integrations/clients/:id/rotate", ({ params }) =>
    HttpResponse.json({
      id: Number(params.id),
      name: "Home Assistant",
      rate_limit_per_minute: 60,
      is_active: true,
      api_key: "mock-api-key-rotated",
      client_id: "mock-client-id-rotated",
      client_secret: "mock-client-secret-rotated",
      token_url: "http://localhost/mock-issuer/token",
    }),
  ),

  http.delete("/api/integrations/clients/:id", () => new HttpResponse(null, { status: 204 })),
];
