import { ApiError, fetchWithAuth, getJson, readErrorBody, sendJson } from "@/lib/api/http";
import type { CalendarFeedResponse, UserSettings, UserSettingsPatch } from "@/api-types";
import * as m from "@/paraglide/messages";

export async function fetchCalendarFeed(signal?: AbortSignal): Promise<CalendarFeedResponse> {
  return getJson<CalendarFeedResponse>(
    "/api/calendar/feed",
    signal,
    2,
    m.api_calendar_feed_load_failed(),
  );
}

export async function regenerateCalendarFeed(): Promise<CalendarFeedResponse> {
  return sendJson<CalendarFeedResponse>(
    "POST",
    "/api/calendar/feed/regenerate",
    undefined,
    m.api_calendar_feed_regenerate_failed(),
  );
}

export async function fetchUserSettings(signal?: AbortSignal): Promise<UserSettings> {
  return getJson<UserSettings>("/api/users/me/settings", signal, 2, m.api_request_failed());
}

export async function updateUserSettings(patch: UserSettingsPatch): Promise<UserSettings> {
  return sendJson<UserSettings>(
    "PATCH",
    "/api/users/me/settings",
    patch,
    m.api_settings_update_failed(),
  );
}

export async function deleteAccount(): Promise<void> {
  const response = await fetchWithAuth("/api/users/me", { method: "DELETE" });
  if (response.ok) {
    return;
  }

  const { message, code, params } = await readErrorBody(response, m.api_account_delete_failed());
  throw new ApiError(message, response.status, false, null, code, params);
}
