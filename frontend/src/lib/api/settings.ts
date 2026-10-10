import { fetchWithAuth, getJson, sendJson } from "@/lib/api/http";
import { z } from "zod";
import * as m from "@/paraglide/messages";

export interface CalendarFeedResponse {
  token: string;
  feed_url: string;
}

export interface UserSettings {
  timezone: string;
  default_snooze_days: number;
  medication_reminder_minutes: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  push_overdue_chores_enabled: boolean;
  push_medication_reminders_enabled: boolean;
  push_missed_medications_enabled: boolean;
}

export interface UserSettingsPatch {
  timezone?: string;
  default_snooze_days?: number;
  medication_reminder_minutes?: number;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  push_overdue_chores_enabled?: boolean;
  push_medication_reminders_enabled?: boolean;
  push_missed_medications_enabled?: boolean;
}

const calendarFeedResponseSchema = z.object({
  token: z.string(),
  feed_url: z.string(),
});

const userSettingsSchema = z.object({
  timezone: z.string(),
  default_snooze_days: z.number(),
  medication_reminder_minutes: z.number(),
  quiet_hours_start: z.string().nullable(),
  quiet_hours_end: z.string().nullable(),
  push_overdue_chores_enabled: z.boolean(),
  push_medication_reminders_enabled: z.boolean(),
  push_missed_medications_enabled: z.boolean(),
});

export async function fetchCalendarFeed(signal?: AbortSignal): Promise<CalendarFeedResponse> {
  return getJson(
    "/api/calendar/feed",
    calendarFeedResponseSchema,
    signal,
    2,
    m.api_calendar_feed_load_failed(),
  );
}

export async function regenerateCalendarFeed(): Promise<CalendarFeedResponse> {
  return sendJson(
    "POST",
    "/api/calendar/feed/regenerate",
    undefined,
    calendarFeedResponseSchema,
    m.api_calendar_feed_regenerate_failed(),
  );
}

export async function fetchUserSettings(signal?: AbortSignal): Promise<UserSettings> {
  return getJson("/api/users/me/settings", userSettingsSchema, signal, 2, m.api_request_failed());
}

export async function updateUserSettings(patch: UserSettingsPatch): Promise<UserSettings> {
  return sendJson(
    "PATCH",
    "/api/users/me/settings",
    patch,
    userSettingsSchema,
    m.api_settings_update_failed(),
  );
}

export async function deleteAccount(): Promise<void> {
  const response = await fetchWithAuth("/api/users/me", { method: "DELETE" });
  if (response.ok) {
    return;
  }

  let message: string = m.api_account_delete_failed();
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") message = body.detail;
  } catch {
    // keep fallback message
  }
  throw new Error(message);
}
