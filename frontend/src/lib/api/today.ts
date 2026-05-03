export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";
export type ChoreStatus = "pending" | "completed" | "skipped";
export type MedicationDoseStatus = "scheduled" | "taken" | "skipped" | "missed";
export type PlannedItemModuleKey =
  | "shopping_list"
  | "meal_planning"
  | "recurring_grocery"
  | "shared_calendar";
import { refreshSessionTokens } from "./auth";
import { getStoredTokens } from "../auth/session";

export interface MedicationTodayItem {
  medication_dose_instance_id: number;
  medication_plan_id: number;
  name: string;
  instructions: string;
  scheduled_at: string;
  status: MedicationDoseStatus;
}

export interface MedicationHistoryItem {
  medication_dose_instance_id: number;
  medication_plan_id: number;
  name: string;
  instructions: string;
  scheduled_at: string;
  status: MedicationDoseStatus;
}

export interface RoutineTodayItem {
  task_instance_id: number;
  routine_template_id: number;
  title: string;
  status: TaskStatus;
  scheduled_date: string;
  due_at: string | null;
}

export interface OverdueTodayItem {
  chore_instance_id: number;
  chore_template_id: number;
  title: string;
  status: ChoreStatus;
  overdue_since: string;
}

export interface DueTodayItem {
  chore_instance_id: number;
  chore_template_id: number;
  title: string;
  status: ChoreStatus;
  scheduled_date: string;
}

export interface UpcomingTodayItem {
  chore_instance_id: number;
  chore_template_id: number;
  title: string;
  scheduled_date: string;
}

export interface PlannedTodayItem {
  id: number;
  title: string;
  planned_for: string;
  notes: string | null;
  module_key: PlannedItemModuleKey | null;
  recurrence_hint: string | null;
  linked_source: string | null;
  linked_ref: string | null;
  is_done: boolean;
}

export interface PlannedItemInput {
  title: string;
  planned_for: string;
  notes?: string | null;
  module_key?: PlannedItemModuleKey | null;
  recurrence_hint?: string | null;
  linked_source?: string | null;
  linked_ref?: string | null;
}

export interface PlannedItemUpdateInput extends PlannedItemInput {
  is_done: boolean;
}

export interface PlannedItemBackupFile {
  exported_at: string;
  source: "daynest";
  schema_version: 1;
  items: PlannedItemInput[];
}

export interface UnifiedDayItem {
  item_type: "routine" | "chore" | "medication" | "planned";
  item_id: number;
  title: string;
  status: string;
  scheduled_at: string | null;
  scheduled_date: string | null;
  detail: string | null;
  module_key: PlannedItemModuleKey | null;
}

export interface CalendarDayPayload {
  date: string;
  items: UnifiedDayItem[];
}

export interface CalendarMonthDaySummary {
  date: string;
  total: number;
  routines: number;
  chores: number;
  medications: number;
  planned: number;
}

export interface CalendarMonthPayload {
  year: number;
  month: number;
  days: CalendarMonthDaySummary[];
}

export interface TodayPayload {
  medication: MedicationTodayItem[];
  medication_history: MedicationHistoryItem[];
  routines: RoutineTodayItem[];
  overdue: OverdueTodayItem[];
  due_today: DueTodayItem[];
  upcoming: UpcomingTodayItem[];
  planned: PlannedTodayItem[];
  day_items: UnifiedDayItem[];
}

export interface ChoreMutationResponse {
  chore_instance_id: number;
  status: ChoreStatus;
  scheduled_date: string;
  completed_at: string | null;
  skipped_at: string | null;
}

export interface TaskMutationResponse {
  task_instance_id: number;
  status: TaskStatus;
  scheduled_date: string;
  due_at: string | null;
  completed_at: string | null;
}

export interface MedicationMutationResponse {
  medication_dose_instance_id: number;
  status: MedicationDoseStatus;
  scheduled_date: string;
}

export interface MedicationPlan {
  id: number;
  name: string;
  instructions: string;
  start_date: string;
  schedule_time: string;
  every_n_days: number;
  is_active: boolean;
}

export interface MedicationPlanInput {
  name: string;
  instructions: string;
  start_date: string;
  schedule_time: string;
  every_n_days: number;
}

export interface MedicationHistoryResponse {
  history: MedicationHistoryItem[];
}

export interface IntegrationClient {
  id: number;
  name: string;
  scopes: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
}

export interface IntegrationClientInput {
  name: string;
  scopes: string[];
  rate_limit_per_minute: number;
}

export interface IntegrationClientCreateResponse extends IntegrationClient {
  api_key: string;
}

export interface RoutineTemplate {
  id: number;
  name: string;
  description: string | null;
  start_date: string;
  every_n_days: number;
  due_time: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RoutineTemplateInput {
  name: string;
  description?: string | null;
  start_date: string;
  every_n_days: number;
  due_time?: string | null;
  is_active: boolean;
}

export interface ChoreTemplate {
  id: number;
  name: string;
  description: string | null;
  start_date: string;
  every_n_days: number;
  is_active: boolean;
  created_at: string;
}

export interface ChoreTemplateInput {
  name: string;
  description?: string | null;
  start_date: string;
  every_n_days: number;
  is_active: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retries = 2,
): Promise<Response> {
  let attempt = 0;
  let lastError: unknown;
  const isIdempotent =
    !init.method || ["GET", "HEAD", "PUT", "DELETE", "OPTIONS"].includes(init.method.toUpperCase());

  while (attempt <= retries) {
    try {
      const response = await fetch(input, init);
      if (!response.ok && isRetryableStatus(response.status) && attempt < retries && isIdempotent) {
        await sleep(250 * 2 ** attempt);
        attempt += 1;
        continue;
      }
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      lastError = error;
      if (attempt >= retries || !isIdempotent) break;
      await sleep(250 * 2 ** attempt);
      attempt += 1;
    }
  }

  if (lastError instanceof Error) {
    throw new ApiError(`Network request failed: ${lastError.message}`, 0, isIdempotent);
  }
  throw new ApiError("Network request failed.", 0, isIdempotent);
}

function withAuthHeader(init: RequestInit, token?: string): RequestInit {
  if (!token) {
    return init;
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

async function fetchWithDevAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retries = 2,
): Promise<Response> {
  const token = getStoredTokens()?.accessToken;
  const response = await fetchWithRetry(input, withAuthHeader(init, token), retries);

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshSessionTokens();
  if (!refreshed) {
    return response;
  }

  const body = init.body;
  const isBodyRewindable =
    body === null ||
    body === undefined ||
    typeof body === "string" ||
    body instanceof URLSearchParams;
  if (!isBodyRewindable) {
    return response;
  }

  return fetchWithRetry(input, withAuthHeader(init, refreshed.accessToken), retries);
}

async function parseJsonResponse<T>(
  response: Response,
  fallbackMessage = "Request failed",
  isIdempotent = true,
): Promise<T> {
  if (!response.ok) {
    let message = `${fallbackMessage} (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string | unknown[] };
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail) && body.detail.length > 0) {
        message = body.detail
          .map((entry) => {
            if (
              entry &&
              typeof entry === "object" &&
              "msg" in entry &&
              typeof entry.msg === "string"
            ) {
              return entry.msg;
            }
            return JSON.stringify(entry);
          })
          .filter((entry): entry is string => Boolean(entry))
          .join(", ");
      }
    } catch {
      // keep fallback message
    }
    throw new ApiError(
      message,
      response.status,
      isIdempotent && isRetryableStatus(response.status),
    );
  }
  return (await response.json()) as T;
}

export async function fetchToday(signal?: AbortSignal): Promise<TodayPayload> {
  const response = await fetchWithDevAuth(
    "/api/v1/today",
    {
      headers: { Accept: "application/json" },
      signal,
    },
    1,
  );
  return parseJsonResponse<TodayPayload>(response, "Unable to load today's data");
}

export async function fetchCalendarMonth(
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<CalendarMonthPayload> {
  const response = await fetchWithDevAuth(
    `/api/v1/calendar/month?year=${year}&month=${month}`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
    1,
  );
  return parseJsonResponse<CalendarMonthPayload>(response);
}

export async function fetchCalendarDay(
  date: string,
  signal?: AbortSignal,
): Promise<CalendarDayPayload> {
  const response = await fetchWithDevAuth(
    `/api/v1/calendar/day?date=${encodeURIComponent(date)}`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
    1,
  );
  return parseJsonResponse<CalendarDayPayload>(response);
}

export async function createPlannedItem(input: PlannedItemInput): Promise<PlannedTodayItem> {
  const response = await fetchWithDevAuth("/api/v1/planned-items", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<PlannedTodayItem>(response, "Request failed", false);
}

export async function updatePlannedItem(
  plannedItemId: number,
  input: PlannedItemUpdateInput,
): Promise<PlannedTodayItem> {
  const response = await fetchWithDevAuth(`/api/v1/planned-items/${plannedItemId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<PlannedTodayItem>(response, "Request failed", false);
}

export async function deletePlannedItem(plannedItemId: number): Promise<void> {
  const response = await fetchWithDevAuth(`/api/v1/planned-items/${plannedItemId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    await parseJsonResponse<never>(response, "Request failed", false);
  }
}

export async function listPlannedItems(
  startDate?: string,
  endDate?: string,
): Promise<PlannedTodayItem[]> {
  const params = new URLSearchParams();
  if (startDate) {
    params.set("start_date", startDate);
  }
  if (endDate) {
    params.set("end_date", endDate);
  }
  const qs = params.toString();

  const response = await fetchWithDevAuth(`/api/v1/planned-items${qs ? `?${qs}` : ""}`, {
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<PlannedTodayItem[]>(response);
}

export async function completeChore(choreInstanceId: number): Promise<ChoreMutationResponse> {
  const response = await fetchWithDevAuth(`/api/v1/chores/${choreInstanceId}/complete`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<ChoreMutationResponse>(response, "Request failed", false);
}

export async function skipChore(choreInstanceId: number): Promise<ChoreMutationResponse> {
  const response = await fetchWithDevAuth(`/api/v1/chores/${choreInstanceId}/skip`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<ChoreMutationResponse>(response, "Request failed", false);
}

export async function rescheduleChore(
  choreInstanceId: number,
  scheduledDate: string,
): Promise<ChoreMutationResponse> {
  const response = await fetchWithDevAuth(`/api/v1/chores/${choreInstanceId}/reschedule`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scheduled_date: scheduledDate }),
  });
  return parseJsonResponse<ChoreMutationResponse>(response, "Request failed", false);
}

export async function takeMedicationDose(
  medicationDoseId: number,
): Promise<MedicationMutationResponse> {
  const response = await fetchWithDevAuth(`/api/v1/medication-doses/${medicationDoseId}/take`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<MedicationMutationResponse>(response, "Request failed", false);
}

export async function skipMedicationDose(
  medicationDoseId: number,
): Promise<MedicationMutationResponse> {
  const response = await fetchWithDevAuth(`/api/v1/medication-doses/${medicationDoseId}/skip`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<MedicationMutationResponse>(response, "Request failed", false);
}

export async function startRoutineTask(taskInstanceId: number): Promise<TaskMutationResponse> {
  const response = await fetchWithDevAuth(`/api/v1/tasks/${taskInstanceId}/start`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<TaskMutationResponse>(response, "Request failed", false);
}

export async function completeRoutineTask(taskInstanceId: number): Promise<TaskMutationResponse> {
  const response = await fetchWithDevAuth(`/api/v1/tasks/${taskInstanceId}/complete`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<TaskMutationResponse>(response, "Request failed", false);
}

export async function skipRoutineTask(taskInstanceId: number): Promise<TaskMutationResponse> {
  const response = await fetchWithDevAuth(`/api/v1/tasks/${taskInstanceId}/skip`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<TaskMutationResponse>(response, "Request failed", false);
}

export async function listMedicationPlans(signal?: AbortSignal): Promise<MedicationPlan[]> {
  const response = await fetchWithDevAuth("/api/v1/medications", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse<MedicationPlan[]>(response);
}

export async function createMedicationPlan(input: MedicationPlanInput): Promise<MedicationPlan> {
  const response = await fetchWithDevAuth("/api/v1/medications", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<MedicationPlan>(response, "Request failed", false);
}

export async function fetchMedicationHistory(
  signal?: AbortSignal,
): Promise<MedicationHistoryItem[]> {
  const response = await fetchWithDevAuth("/api/v1/medication-doses/history", {
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = await parseJsonResponse<MedicationHistoryResponse>(response);
  return payload.history;
}

export async function listIntegrationClients(signal?: AbortSignal): Promise<IntegrationClient[]> {
  const response = await fetchWithDevAuth("/api/v1/integrations/clients", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse<IntegrationClient[]>(response);
}

export async function createIntegrationClient(
  input: IntegrationClientInput,
): Promise<IntegrationClientCreateResponse> {
  const response = await fetchWithDevAuth("/api/v1/integrations/clients", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<IntegrationClientCreateResponse>(response, "Request failed", false);
}

export async function listRoutineTemplates(signal?: AbortSignal): Promise<RoutineTemplate[]> {
  const response = await fetchWithDevAuth("/api/v1/routines", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse<RoutineTemplate[]>(response);
}

export async function createRoutineTemplate(input: RoutineTemplateInput): Promise<RoutineTemplate> {
  const response = await fetchWithDevAuth("/api/v1/routines", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<RoutineTemplate>(response, "Request failed", false);
}

export async function updateRoutineTemplate(
  routineTemplateId: number,
  input: RoutineTemplateInput,
): Promise<RoutineTemplate> {
  const response = await fetchWithDevAuth(`/api/v1/routines/${routineTemplateId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<RoutineTemplate>(response, "Request failed", false);
}

export async function deleteRoutineTemplate(routineTemplateId: number): Promise<void> {
  const response = await fetchWithDevAuth(`/api/v1/routines/${routineTemplateId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    await parseJsonResponse<never>(response, "Request failed", false);
  }
}

export async function listChoreTemplates(signal?: AbortSignal): Promise<ChoreTemplate[]> {
  const response = await fetchWithDevAuth("/api/v1/chore-templates", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse<ChoreTemplate[]>(response);
}

export async function createChoreTemplate(input: ChoreTemplateInput): Promise<ChoreTemplate> {
  const response = await fetchWithDevAuth("/api/v1/chore-templates", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<ChoreTemplate>(response, "Request failed", false);
}

export async function updateChoreTemplate(
  choreTemplateId: number,
  input: ChoreTemplateInput,
): Promise<ChoreTemplate> {
  const response = await fetchWithDevAuth(`/api/v1/chore-templates/${choreTemplateId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<ChoreTemplate>(response, "Request failed", false);
}

export async function deleteChoreTemplate(choreTemplateId: number): Promise<void> {
  const response = await fetchWithDevAuth(`/api/v1/chore-templates/${choreTemplateId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    await parseJsonResponse<never>(response, "Request failed", false);
  }
}

export function isRetryableApiError(error: unknown): boolean {
  return error instanceof ApiError ? error.retryable : false;
}
