import { fetchWithAuth, parseJsonResponse } from "@/lib/api/http";
import { z } from "zod";

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
  const response = await fetchWithAuth("/api/calendar/feed", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse(response, "Failed to load calendar feed", true, calendarFeedResponseSchema);
}

export async function regenerateCalendarFeed(): Promise<CalendarFeedResponse> {
  const response = await fetchWithAuth("/api/calendar/feed/regenerate", {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(response, "Failed to regenerate calendar feed", false, calendarFeedResponseSchema);
}

export async function fetchUserSettings(signal?: AbortSignal): Promise<UserSettings> {
  const response = await fetchWithAuth("/api/users/me/settings", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse(response, "Request failed", true, userSettingsSchema);
}

export async function updateUserSettings(patch: UserSettingsPatch): Promise<UserSettings> {
  const response = await fetchWithAuth("/api/users/me/settings", {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseJsonResponse(response, "Failed to update settings", false, userSettingsSchema);
}
