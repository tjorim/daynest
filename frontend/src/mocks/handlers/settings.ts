import { jsonResponse } from "@/mocks/response";
import type {
  CalendarFeedResponse,
  IntegrationClientCreateResponse,
  IntegrationClientResponse,
  UserSettingsResponse,
} from "@/api-schema";
import { http, HttpResponse } from "msw/http";
import { getMockState, mutateSettings } from "../data/state";
import type { UserSettingsPatch } from "@/api-types";

// Extra legacy mock value retained without declaring it part of the create wire contract.
const legacyCreateExtras = { is_active: true };

let mockCalendarFeedToken = "mock-calendar-feed-token";

export const settingsHandlers = [
  http.get("/api/users/me/settings", () =>
    jsonResponse<UserSettingsResponse>(getMockState().settings),
  ),

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
    return jsonResponse<UserSettingsResponse>(getMockState().settings);
  }),

  http.get("/api/calendar/feed", () =>
    jsonResponse<CalendarFeedResponse>({
      token: mockCalendarFeedToken,
      feed_url: `http://localhost/api/calendar/feed/${mockCalendarFeedToken}.ics`,
    }),
  ),

  http.post("/api/calendar/feed/regenerate", () => {
    mockCalendarFeedToken = `mock-calendar-feed-token-${Date.now()}`;
    return jsonResponse<CalendarFeedResponse>({
      token: mockCalendarFeedToken,
      feed_url: `http://localhost/api/calendar/feed/${mockCalendarFeedToken}.ics`,
    });
  }),

  http.get("/api/integrations/clients", () =>
    jsonResponse<IntegrationClientResponse[]>([
      {
        id: 1,
        name: "Home Assistant",
        rate_limit_per_minute: 60,
        scopes: [],
        is_active: true,
        key_preview: null,
        created_at: "2026-06-01T00:00:00",
        last_used_at: null,
        revoked_at: null,
      },
    ]),
  ),

  http.post("/api/integrations/clients", async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      rate_limit_per_minute: number;
      scopes?: string[];
    };
    return jsonResponse<IntegrationClientCreateResponse>(
      {
        id: 99,
        name: body.name,
        rate_limit_per_minute: body.rate_limit_per_minute,
        ...legacyCreateExtras,
        scopes: body.scopes ?? [],
        api_key: "mock-api-key-new",
        client_id: "mock-client-id-new",
        client_secret: "mock-client-secret-new",
        token_url: "http://localhost/mock-issuer/token",
      },
      { status: 201 },
    );
  }),

  http.post("/api/integrations/clients/:id/rotate", ({ params }) =>
    jsonResponse<IntegrationClientCreateResponse>({
      id: Number(params.id),
      name: "Home Assistant",
      rate_limit_per_minute: 60,
      scopes: [],
      ...legacyCreateExtras,
      api_key: "mock-api-key-rotated",
      client_id: "mock-client-id-rotated",
      client_secret: "mock-client-secret-rotated",
      token_url: "http://localhost/mock-issuer/token",
    }),
  ),

  http.delete("/api/integrations/clients/:id", () => new HttpResponse(null, { status: 204 })),
];
