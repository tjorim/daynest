import { getOidcAccessToken } from "@/lib/auth/session";
import { buildApiUrl } from "@/lib/api/serverConfig";
import { z } from "zod";

export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";
export type ChoreStatus = "pending" | "completed" | "skipped";
export type MedicationDoseStatus = "scheduled" | "taken" | "skipped" | "missed";
export type PlannedItemModuleKey =
  | "shopping_list"
  | "meal_planning"
  | "recurring_grocery"
  | "shared_calendar";

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

export type StatusTone = "primary" | "secondary" | "warning" | "success" | "info" | "danger";

export interface SectionItem {
  id: string;
  title: string;
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

export interface UnifiedDayItem {
  item_type: "routine" | "chore" | "medication" | "planned";
  item_id: number;
  title: string;
  status: string;
  scheduled_at: string | null;
  scheduled_date: string | null;
  detail: string | null;
  module_key: PlannedItemModuleKey | null;
  recurrence_hint?: string | null;
  linked_source?: string | null;
  linked_ref?: string | null;
}

export interface CalendarDayPayload {
  date: string;
  items: UnifiedDayItem[];
}

const plannedItemModuleKeySchema = z.enum([
  "shopping_list",
  "meal_planning",
  "recurring_grocery",
  "shared_calendar",
]);

const taskStatusSchema = z.enum(["pending", "in_progress", "completed", "skipped"]);
const choreStatusSchema = z.enum(["pending", "completed", "skipped"]);
const medicationDoseStatusSchema = z.enum(["scheduled", "taken", "skipped", "missed"]);

const medicationTodayItemSchema = z.object({
  medication_dose_instance_id: z.number(),
  medication_plan_id: z.number(),
  name: z.string(),
  instructions: z.string(),
  scheduled_at: z.string(),
  status: medicationDoseStatusSchema,
});

const medicationHistoryItemSchema = medicationTodayItemSchema;

const routineTodayItemSchema = z.object({
  task_instance_id: z.number(),
  routine_template_id: z.number(),
  title: z.string(),
  status: taskStatusSchema,
  scheduled_date: z.string(),
  due_at: z.string().nullable(),
});

const overdueTodayItemSchema = z.object({
  chore_instance_id: z.number(),
  chore_template_id: z.number(),
  title: z.string(),
  status: choreStatusSchema,
  overdue_since: z.string(),
});

const dueTodayItemSchema = z.object({
  chore_instance_id: z.number(),
  chore_template_id: z.number(),
  title: z.string(),
  status: choreStatusSchema,
  scheduled_date: z.string(),
});

const upcomingTodayItemSchema = z.object({
  chore_instance_id: z.number(),
  chore_template_id: z.number(),
  title: z.string(),
  scheduled_date: z.string(),
});

const plannedTodayItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  planned_for: z.string(),
  notes: z.string().nullable(),
  module_key: plannedItemModuleKeySchema.nullable(),
  recurrence_hint: z.string().nullable(),
  linked_source: z.string().nullable(),
  linked_ref: z.string().nullable(),
  is_done: z.boolean(),
});

const unifiedDayItemSchema = z.object({
  item_type: z.enum(["routine", "chore", "medication", "planned"]),
  item_id: z.number(),
  title: z.string(),
  status: z.string(),
  scheduled_at: z.string().nullable(),
  scheduled_date: z.string().nullable(),
  detail: z.string().nullable(),
  module_key: plannedItemModuleKeySchema.nullable(),
  recurrence_hint: z.string().nullable().optional(),
  linked_source: z.string().nullable().optional(),
  linked_ref: z.string().nullable().optional(),
});

const calendarMonthDaySummarySchema = z.object({
  date: z.string(),
  total: z.number(),
  routines: z.number(),
  chores: z.number(),
  medications: z.number(),
  planned: z.number(),
});

export const CalendarMonthResponseSchema = z.object({
  year: z.number(),
  month: z.number(),
  days: z.array(calendarMonthDaySummarySchema),
});

export type CalendarMonthDaySummary = z.infer<typeof calendarMonthDaySummarySchema>;
export type CalendarMonthPayload = z.infer<typeof CalendarMonthResponseSchema>;

export const TodayResponseSchema = z.object({
  medication: z.array(medicationTodayItemSchema),
  medication_history: z.array(medicationHistoryItemSchema),
  routines: z.array(routineTodayItemSchema),
  overdue: z.array(overdueTodayItemSchema),
  due_today: z.array(dueTodayItemSchema),
  upcoming: z.array(upcomingTodayItemSchema),
  planned: z.array(plannedTodayItemSchema),
  day_items: z.array(unifiedDayItemSchema),
});

export type TodayPayload = z.infer<typeof TodayResponseSchema>;

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

export interface MedicationPlanUpdateInput extends MedicationPlanInput {
  is_active: boolean;
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
  client_id: string;
  client_secret: string;
  token_url: string;
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

async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retries = 2,
): Promise<Response> {
  const token = getOidcAccessToken();
  if (!token) {
    throw new ApiError("Not authenticated", 401);
  }
  const url =
    typeof input === "string" && !/^https?:\/\//i.test(input) ? buildApiUrl(input) : input;
  return fetchWithRetry(url, withAuthHeader(init, token), retries);
}

async function parseJsonResponse<T>(
  response: Response,
  fallbackMessage = "Request failed",
  isIdempotent = true,
  schema?: z.ZodType<T>,
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
  const payload = (await response.json()) as unknown;

  if (!schema) {
    return payload as T;
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "response";
        return `${path}: ${issue.message}`;
      })
      .join(", ");
    throw new ApiError(`Invalid response format: ${details}`, response.status, false);
  }

  return result.data;
}

export async function fetchToday(signal?: AbortSignal): Promise<TodayPayload> {
  const response = await fetchWithAuth(
    "/api/v1/today",
    {
      headers: { Accept: "application/json" },
      signal,
    },
    1,
  );
  return parseJsonResponse(response, "Unable to load today's data", true, TodayResponseSchema);
}

export async function fetchCalendarMonth(
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<CalendarMonthPayload> {
  const response = await fetchWithAuth(
    `/api/v1/calendar/month?year=${year}&month=${month}`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
    1,
  );
  return parseJsonResponse(response, "Request failed", true, CalendarMonthResponseSchema);
}

export async function fetchCalendarDay(
  date: string,
  signal?: AbortSignal,
): Promise<CalendarDayPayload> {
  const response = await fetchWithAuth(
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
  const response = await fetchWithAuth("/api/v1/planned-items", {
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
  const response = await fetchWithAuth(`/api/v1/planned-items/${plannedItemId}`, {
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
  const response = await fetchWithAuth(`/api/v1/planned-items/${plannedItemId}`, {
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

  const response = await fetchWithAuth(`/api/v1/planned-items${qs ? `?${qs}` : ""}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse<PlannedTodayItem[]>(response);
}

export async function completeChore(choreInstanceId: number): Promise<ChoreMutationResponse> {
  const response = await fetchWithAuth(`/api/v1/chores/${choreInstanceId}/complete`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<ChoreMutationResponse>(response, "Request failed", false);
}

export async function skipChore(choreInstanceId: number): Promise<ChoreMutationResponse> {
  const response = await fetchWithAuth(`/api/v1/chores/${choreInstanceId}/skip`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<ChoreMutationResponse>(response, "Request failed", false);
}

export async function rescheduleChore(
  choreInstanceId: number,
  scheduledDate: string,
): Promise<ChoreMutationResponse> {
  const response = await fetchWithAuth(`/api/v1/chores/${choreInstanceId}/reschedule`, {
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
  const response = await fetchWithAuth(`/api/v1/medication-doses/${medicationDoseId}/take`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<MedicationMutationResponse>(response, "Request failed", false);
}

export async function skipMedicationDose(
  medicationDoseId: number,
): Promise<MedicationMutationResponse> {
  const response = await fetchWithAuth(`/api/v1/medication-doses/${medicationDoseId}/skip`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<MedicationMutationResponse>(response, "Request failed", false);
}

export async function startRoutineTask(taskInstanceId: number): Promise<TaskMutationResponse> {
  const response = await fetchWithAuth(`/api/v1/tasks/${taskInstanceId}/start`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<TaskMutationResponse>(response, "Request failed", false);
}

export async function completeRoutineTask(taskInstanceId: number): Promise<TaskMutationResponse> {
  const response = await fetchWithAuth(`/api/v1/tasks/${taskInstanceId}/complete`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<TaskMutationResponse>(response, "Request failed", false);
}

export async function skipRoutineTask(taskInstanceId: number): Promise<TaskMutationResponse> {
  const response = await fetchWithAuth(`/api/v1/tasks/${taskInstanceId}/skip`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<TaskMutationResponse>(response, "Request failed", false);
}

export async function listMedicationPlans(signal?: AbortSignal): Promise<MedicationPlan[]> {
  const response = await fetchWithAuth("/api/v1/medications", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse<MedicationPlan[]>(response);
}

export async function createMedicationPlan(input: MedicationPlanInput): Promise<MedicationPlan> {
  const response = await fetchWithAuth("/api/v1/medications", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<MedicationPlan>(response, "Request failed", false);
}

export async function updateMedicationPlan(
  medicationPlanId: number,
  input: MedicationPlanUpdateInput,
): Promise<MedicationPlan> {
  const response = await fetchWithAuth(`/api/v1/medications/${medicationPlanId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<MedicationPlan>(response, "Request failed", false);
}

export async function deleteMedicationPlan(medicationPlanId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/v1/medications/${medicationPlanId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    await parseJsonResponse<never>(response, "Request failed", false);
  }
}

export async function fetchMedicationHistory(
  signal?: AbortSignal,
): Promise<MedicationHistoryItem[]> {
  const response = await fetchWithAuth("/api/v1/medication-doses/history", {
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = await parseJsonResponse<MedicationHistoryResponse>(response);
  return payload.history;
}

export async function listIntegrationClients(signal?: AbortSignal): Promise<IntegrationClient[]> {
  const response = await fetchWithAuth("/api/v1/integrations/clients", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse<IntegrationClient[]>(response);
}

export async function createIntegrationClient(
  input: IntegrationClientInput,
): Promise<IntegrationClientCreateResponse> {
  const response = await fetchWithAuth("/api/v1/integrations/clients", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<IntegrationClientCreateResponse>(response, "Request failed", false);
}

export async function rotateIntegrationClient(clientId: number): Promise<IntegrationClientCreateResponse> {
  const response = await fetchWithAuth(`/api/v1/integrations/clients/${clientId}/rotate`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<IntegrationClientCreateResponse>(response, "Failed to rotate integration client", false);
}

export async function revokeIntegrationClient(clientId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/v1/integrations/clients/${clientId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    await parseJsonResponse<never>(response, "Failed to revoke integration client");
  }
}

export async function listRoutineTemplates(signal?: AbortSignal): Promise<RoutineTemplate[]> {
  const response = await fetchWithAuth("/api/v1/routines", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse<RoutineTemplate[]>(response);
}

export async function createRoutineTemplate(input: RoutineTemplateInput): Promise<RoutineTemplate> {
  const response = await fetchWithAuth("/api/v1/routines", {
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
  const response = await fetchWithAuth(`/api/v1/routines/${routineTemplateId}`, {
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
  const response = await fetchWithAuth(`/api/v1/routines/${routineTemplateId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    await parseJsonResponse<never>(response, "Request failed", false);
  }
}

export async function listChoreTemplates(signal?: AbortSignal): Promise<ChoreTemplate[]> {
  const response = await fetchWithAuth("/api/v1/chore-templates", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse<ChoreTemplate[]>(response);
}

export async function createChoreTemplate(input: ChoreTemplateInput): Promise<ChoreTemplate> {
  const response = await fetchWithAuth("/api/v1/chore-templates", {
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
  const response = await fetchWithAuth(`/api/v1/chore-templates/${choreTemplateId}`, {
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
  const response = await fetchWithAuth(`/api/v1/chore-templates/${choreTemplateId}`, {
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
