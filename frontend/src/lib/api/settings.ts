import { getJson, sendJson } from "@/lib/api/http";
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
  return getJson("/api/calendar/feed", calendarFeedResponseSchema, signal, 2, "Failed to load calendar feed");
}

export async function regenerateCalendarFeed(): Promise<CalendarFeedResponse> {
  return sendJson(
    "POST",
    "/api/calendar/feed/regenerate",
    undefined,
    calendarFeedResponseSchema,
    "Failed to regenerate calendar feed",
  );
}

export async function fetchUserSettings(signal?: AbortSignal): Promise<UserSettings> {
  return getJson("/api/users/me/settings", userSettingsSchema, signal, 2, "Request failed");
}

export async function updateUserSettings(patch: UserSettingsPatch): Promise<UserSettings> {
  return sendJson("PATCH", "/api/users/me/settings", patch, userSettingsSchema, "Failed to update settings");
}
