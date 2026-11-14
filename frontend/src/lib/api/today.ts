import { fetchWithAuth, getJson, parseJsonResponse, sendJson } from "@/lib/api/http";
export {
  ApiError,
  fetchWithAuth,
  fetchWithRetry,
  getJson,
  isRetryableApiError,
  isRetryableStatus,
  parseJsonResponse,
  sendJson,
  sleep,
  withAuthHeader,
} from "@/lib/api/http";
import type {
  CalendarDayPayload,
  CalendarMonthPayload,
  CalendarRangePayload,
  ChoreMutationResponse,
  MedicationMutationResponse,
  PlannedItemInput,
  PlannedItemUpdateInput,
  PlannedTodayItem,
  TaskMutationResponse,
  TaskStatus,
  TodayPayload,
} from "@/api-types";
import * as m from "@/paraglide/messages";

export type PlannedItemEditScope = "this" | "future" | "all";
export type PlannedItemDeleteScope = "this" | "future";

export type StatusTone = "primary" | "secondary" | "warning" | "success" | "info" | "danger";

export interface SectionItem {
  id: string;
  title: string;
  isRecurring?: boolean;
  subtitle?: string;
  instructions?: string;
  statusLabel?: string;
  statusTone?: StatusTone;
  taskInstanceId?: number;
  taskStatus?: TaskStatus;
  choreInstanceId?: number;
  choreStatus?: string;
  scheduledDate?: string;
  medicationDoseInstanceId?: number;
  medicationStatus?: string;
  plannedItem?: PlannedTodayItem;
}

export interface PlannedItemBackupFile {
  exported_at: string;
  source: "daynest";
  schema_version: 1;
  items: PlannedItemInput[];
}

export async function fetchToday(signal?: AbortSignal): Promise<TodayPayload> {
  return getJson<TodayPayload>("/api/today", signal, 1, m.api_today_load_failed());
}

export async function fetchCalendarMonth(
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<CalendarMonthPayload> {
  return getJson<CalendarMonthPayload>(`/api/calendar/month?year=${year}&month=${month}`, signal);
}

export async function fetchCalendarDay(
  date: string,
  signal?: AbortSignal,
): Promise<CalendarDayPayload> {
  return getJson<CalendarDayPayload>(`/api/calendar/day?date=${encodeURIComponent(date)}`, signal);
}

export async function fetchCalendarRange(
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<CalendarRangePayload> {
  const params = new URLSearchParams({ start, end });
  return getJson<CalendarRangePayload>(`/api/calendar/range?${params.toString()}`, signal);
}

export async function createPlannedItem(input: PlannedItemInput): Promise<PlannedTodayItem> {
  return sendJson<PlannedTodayItem>("POST", "/api/planned-items", input);
}

export async function updatePlannedItem(
  plannedItemId: number,
  input: PlannedItemUpdateInput,
  scope: PlannedItemEditScope = "this",
): Promise<PlannedTodayItem> {
  return sendJson<PlannedTodayItem>(
    "PUT",
    `/api/planned-items/${plannedItemId}?scope=${scope}`,
    input,
  );
}

export async function deletePlannedItem(
  plannedItemId: number,
  scope: PlannedItemDeleteScope = "this",
): Promise<void> {
  const response = await fetchWithAuth(`/api/planned-items/${plannedItemId}?scope=${scope}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // Error-only parse; successful deletes return 204 with no JSON body.
    await parseJsonResponse<never>(response, m.api_request_failed(), false);
  }
}

export async function listPlannedItems(
  startDate?: string,
  endDate?: string,
  signal?: AbortSignal,
): Promise<PlannedTodayItem[]> {
  const params = new URLSearchParams();
  if (startDate) {
    params.set("start_date", startDate);
  }
  if (endDate) {
    params.set("end_date", endDate);
  }
  const qs = params.toString();

  return getJson<PlannedTodayItem[]>(`/api/planned-items${qs ? `?${qs}` : ""}`, signal);
}

export async function completeChore(choreInstanceId: number): Promise<ChoreMutationResponse> {
  const response = await fetchWithAuth(`/api/chores/${choreInstanceId}/complete`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<ChoreMutationResponse>(response, m.api_request_failed(), false);
}

export async function skipChore(choreInstanceId: number): Promise<ChoreMutationResponse> {
  const response = await fetchWithAuth(`/api/chores/${choreInstanceId}/skip`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<ChoreMutationResponse>(response, m.api_request_failed(), false);
}

export async function rescheduleChore(
  choreInstanceId: number,
  scheduledDate: string,
): Promise<ChoreMutationResponse> {
  const response = await fetchWithAuth(`/api/chores/${choreInstanceId}/reschedule`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scheduled_date: scheduledDate }),
  });
  return parseJsonResponse<ChoreMutationResponse>(response, m.api_request_failed(), false);
}

export async function takeMedicationDose(
  medicationDoseId: number,
): Promise<MedicationMutationResponse> {
  return sendJson<MedicationMutationResponse>(
    "POST",
    `/api/medication-doses/${medicationDoseId}/take`,
    undefined,
  );
}

export async function skipMedicationDose(
  medicationDoseId: number,
): Promise<MedicationMutationResponse> {
  return sendJson<MedicationMutationResponse>(
    "POST",
    `/api/medication-doses/${medicationDoseId}/skip`,
    undefined,
  );
}

export async function startRoutineTask(taskInstanceId: number): Promise<TaskMutationResponse> {
  const response = await fetchWithAuth(`/api/tasks/${taskInstanceId}/start`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<TaskMutationResponse>(response, m.api_request_failed(), false);
}

export async function completeRoutineTask(taskInstanceId: number): Promise<TaskMutationResponse> {
  const response = await fetchWithAuth(`/api/tasks/${taskInstanceId}/complete`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<TaskMutationResponse>(response, m.api_request_failed(), false);
}

export async function skipRoutineTask(taskInstanceId: number): Promise<TaskMutationResponse> {
  const response = await fetchWithAuth(`/api/tasks/${taskInstanceId}/skip`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<TaskMutationResponse>(response, m.api_request_failed(), false);
}

// --- Planned item reschedule ---

export async function reschedulePlannedItem(
  plannedItemId: number,
  newDate: string,
): Promise<PlannedTodayItem> {
  const response = await fetchWithAuth(`/api/planned-items/${plannedItemId}`, {
    method: "PUT",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ planned_for: newDate }),
  });
  return parseJsonResponse<PlannedTodayItem>(response, m.api_reschedule_failed(), false);
}
