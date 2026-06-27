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

export type MedicationHistoryItem = MedicationTodayItem;

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

export type PlannedItemPriority = "low" | "normal" | "high";

export interface PlannedTodayItem {
  id: number;
  title: string;
  planned_for: string;
  time_of_day: string | null;
  duration_minutes: number | null;
  notes: string | null;
  module_key: PlannedItemModuleKey | null;
  recurrence_hint: string | null;
  rrule: string | null;
  recurrence_series_id: string | null;
  linked_source: string | null;
  linked_ref: string | null;
  auto_add_to_list_id?: number | null;
  priority?: PlannedItemPriority;
  tags?: string[];
  is_done: boolean;
}

export interface PlannedItemInput {
  title: string;
  planned_for: string;
  time_of_day?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  module_key?: PlannedItemModuleKey | null;
  recurrence_hint?: string | null;
  rrule?: string | null;
  linked_source?: string | null;
  linked_ref?: string | null;
  auto_add_to_list_id?: number | null;
  priority?: PlannedItemPriority;
  tags?: string[];
}

export interface PlannedItemUpdateInput extends PlannedItemInput {
  is_done: boolean;
}

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

export interface UnifiedDayItem {
  item_type: "routine" | "chore" | "medication" | "planned";
  item_id: number;
  title: string;
  status: string;
  scheduled_at: string | null;
  scheduled_date: string | null;
  duration_minutes?: number | null;
  detail: string | null;
  module_key: PlannedItemModuleKey | null;
  rrule?: string | null;
  recurrence_series_id?: string | null;
  recurrence_hint?: string | null;
  linked_source?: string | null;
  linked_ref?: string | null;
}

export interface CalendarDayPayload {
  date: string;
  items: UnifiedDayItem[];
}

export interface CalendarRangePayload {
  items: UnifiedDayItem[];
}

const plannedItemPrioritySchema = z.enum(["low", "normal", "high"]);

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

export const plannedTodayItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  planned_for: z.string(),
  time_of_day: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
    .nullable(),
  duration_minutes: z.number().int().nullable(),
  notes: z.string().nullable(),
  module_key: plannedItemModuleKeySchema.nullable(),
  recurrence_hint: z.string().nullable(),
  rrule: z.string().nullable(),
  recurrence_series_id: z.string().nullable(),
  linked_source: z.string().nullable(),
  linked_ref: z.string().nullable(),
  auto_add_to_list_id: z.number().int().nullable().optional(),
  priority: plannedItemPrioritySchema.nullable().transform((v) => v ?? undefined).optional(),
  tags: z.array(z.string()).nullable().transform((v) => v ?? undefined).optional(),
  is_done: z.boolean(),
});

const unifiedDayItemSchema = z.object({
  item_type: z.enum(["routine", "chore", "medication", "planned"]),
  item_id: z.number(),
  title: z.string(),
  status: z.string(),
  scheduled_at: z.string().nullable(),
  scheduled_date: z.string().nullable(),
  duration_minutes: z.number().int().nullable().optional(),
  detail: z.string().nullable(),
  module_key: plannedItemModuleKeySchema.nullable(),
  rrule: z.string().nullable().optional(),
  recurrence_series_id: z.string().nullable().optional(),
  recurrence_hint: z.string().nullable().optional(),
  linked_source: z.string().nullable().optional(),
  linked_ref: z.string().nullable().optional(),
});

export const CalendarRangeResponseSchema = z.object({
  items: z.array(unifiedDayItemSchema),
});

export const CalendarDayResponseSchema = z.object({
  date: z.string(),
  items: z.array(unifiedDayItemSchema),
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

const plannedTodayItemsSchema = z.array(plannedTodayItemSchema);

const choreMutationResponseSchema = z.object({
  chore_instance_id: z.number(),
  status: choreStatusSchema,
  scheduled_date: z.string(),
  completed_at: z.string().nullable(),
  skipped_at: z.string().nullable(),
});

const taskMutationResponseSchema = z.object({
  task_instance_id: z.number(),
  status: taskStatusSchema,
  scheduled_date: z.string(),
  due_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});

const medicationMutationResponseSchema = z.object({
  medication_dose_instance_id: z.number(),
  status: medicationDoseStatusSchema,
  scheduled_date: z.string(),
});

const medicationPlanSchema = z.object({
  id: z.number(),
  name: z.string(),
  instructions: z.string(),
  start_date: z.string(),
  schedule_time: z.string(),
  every_n_days: z.number(),
  is_active: z.boolean(),
});

const medicationHistoryResponseSchema = z.object({
  history: z.array(medicationHistoryItemSchema),
});

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
  rate_limit_per_minute: number;
  is_active: boolean;
}

export interface IntegrationClientInput {
  name: string;
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

const integrationClientSchema = z.object({
  id: z.number(),
  name: z.string(),
  rate_limit_per_minute: z.number(),
  is_active: z.boolean(),
});

const integrationClientCreateResponseSchema = integrationClientSchema.extend({
  api_key: z.string(),
  client_id: z.string(),
  client_secret: z.string(),
  token_url: z.string(),
});

const routineTemplateSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  start_date: z.string(),
  every_n_days: z.number(),
  due_time: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
});

const choreTemplateSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  start_date: z.string(),
  every_n_days: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export async function fetchToday(signal?: AbortSignal): Promise<TodayPayload> {
  return getJson("/api/today", TodayResponseSchema, signal, 1, "Unable to load today's data");
}

export async function fetchCalendarMonth(
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<CalendarMonthPayload> {
  return getJson(
    `/api/calendar/month?year=${year}&month=${month}`,
    CalendarMonthResponseSchema,
    signal,
  );
}

export async function fetchCalendarDay(
  date: string,
  signal?: AbortSignal,
): Promise<CalendarDayPayload> {
  return getJson(
    `/api/calendar/day?date=${encodeURIComponent(date)}`,
    CalendarDayResponseSchema,
    signal,
  );
}

export async function fetchCalendarRange(
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<CalendarRangePayload> {
  const params = new URLSearchParams({ start, end });
  return getJson(`/api/calendar/range?${params.toString()}`, CalendarRangeResponseSchema, signal);
}

export async function createPlannedItem(input: PlannedItemInput): Promise<PlannedTodayItem> {
  return sendJson("POST", "/api/planned-items", input, plannedTodayItemSchema);
}

export async function updatePlannedItem(
  plannedItemId: number,
  input: PlannedItemUpdateInput,
  scope: PlannedItemEditScope = "this",
): Promise<PlannedTodayItem> {
  return sendJson("PUT", `/api/planned-items/${plannedItemId}?scope=${scope}`, input, plannedTodayItemSchema);
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

  return getJson(`/api/planned-items${qs ? `?${qs}` : ""}`, plannedTodayItemsSchema, signal);
}

export async function completeChore(choreInstanceId: number): Promise<ChoreMutationResponse> {
  const response = await fetchWithAuth(`/api/chores/${choreInstanceId}/complete`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(response, "Request failed", false, choreMutationResponseSchema);
}

export async function skipChore(choreInstanceId: number): Promise<ChoreMutationResponse> {
  const response = await fetchWithAuth(`/api/chores/${choreInstanceId}/skip`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(response, "Request failed", false, choreMutationResponseSchema);
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
  return parseJsonResponse(response, "Request failed", false, choreMutationResponseSchema);
}

export async function takeMedicationDose(
  medicationDoseId: number,
): Promise<MedicationMutationResponse> {
  return sendJson("POST", `/api/medication-doses/${medicationDoseId}/take`, undefined, medicationMutationResponseSchema);
}

export async function skipMedicationDose(
  medicationDoseId: number,
): Promise<MedicationMutationResponse> {
  return sendJson("POST", `/api/medication-doses/${medicationDoseId}/skip`, undefined, medicationMutationResponseSchema);
}

export async function startRoutineTask(taskInstanceId: number): Promise<TaskMutationResponse> {
  const response = await fetchWithAuth(`/api/tasks/${taskInstanceId}/start`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(response, "Request failed", false, taskMutationResponseSchema);
}

export async function completeRoutineTask(taskInstanceId: number): Promise<TaskMutationResponse> {
  const response = await fetchWithAuth(`/api/tasks/${taskInstanceId}/complete`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(response, "Request failed", false, taskMutationResponseSchema);
}

export async function skipRoutineTask(taskInstanceId: number): Promise<TaskMutationResponse> {
  const response = await fetchWithAuth(`/api/tasks/${taskInstanceId}/skip`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(response, "Request failed", false, taskMutationResponseSchema);
}

export async function listMedicationPlans(signal?: AbortSignal): Promise<MedicationPlan[]> {
  return getJson("/api/medications", z.array(medicationPlanSchema), signal);
}

export async function createMedicationPlan(input: MedicationPlanInput): Promise<MedicationPlan> {
  return sendJson("POST", "/api/medications", input, medicationPlanSchema);
}

export async function updateMedicationPlan(
  medicationPlanId: number,
  input: MedicationPlanUpdateInput,
): Promise<MedicationPlan> {
  return sendJson("PUT", `/api/medications/${medicationPlanId}`, input, medicationPlanSchema);
}

export async function deleteMedicationPlan(medicationPlanId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/medications/${medicationPlanId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // Error-only parse; successful deletes return 204 with no JSON body.
    await parseJsonResponse<never>(response, "Request failed", false);
  }
}

export async function fetchMedicationHistory(
  signal?: AbortSignal,
): Promise<MedicationHistoryItem[]> {
  const payload = await getJson("/api/medication-doses/history", medicationHistoryResponseSchema, signal);
  return payload.history;
}

export interface CalendarFeedResponse {
  token: string;
  feed_url: string;
}

const calendarFeedResponseSchema = z.object({
  token: z.string(),
  feed_url: z.string(),
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

export async function listIntegrationClients(signal?: AbortSignal): Promise<IntegrationClient[]> {
  const response = await fetchWithAuth("/api/integrations/clients", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse(response, "Request failed", true, z.array(integrationClientSchema));
}

export async function createIntegrationClient(
  input: IntegrationClientInput,
): Promise<IntegrationClientCreateResponse> {
  const response = await fetchWithAuth("/api/integrations/clients", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response, "Request failed", false, integrationClientCreateResponseSchema);
}

export async function rotateIntegrationClient(
  clientId: number,
): Promise<IntegrationClientCreateResponse> {
  const response = await fetchWithAuth(`/api/integrations/clients/${clientId}/rotate`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(
    response,
    "Failed to rotate integration client",
    false,
    integrationClientCreateResponseSchema,
  );
}

export async function revokeIntegrationClient(clientId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/integrations/clients/${clientId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    // Error-only parse; successful revocations return 204 with no JSON body.
    await parseJsonResponse<never>(response, "Failed to revoke integration client");
  }
}

export async function listRoutineTemplates(signal?: AbortSignal): Promise<RoutineTemplate[]> {
  const response = await fetchWithAuth("/api/templates/routines", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse(response, "Request failed", true, z.array(routineTemplateSchema));
}

export async function createRoutineTemplate(input: RoutineTemplateInput): Promise<RoutineTemplate> {
  const response = await fetchWithAuth("/api/templates/routines", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response, "Request failed", false, routineTemplateSchema);
}

export async function updateRoutineTemplate(
  routineTemplateId: number,
  input: RoutineTemplateInput,
): Promise<RoutineTemplate> {
  const response = await fetchWithAuth(`/api/templates/routines/${routineTemplateId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response, "Request failed", false, routineTemplateSchema);
}

export async function deleteRoutineTemplate(routineTemplateId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/templates/routines/${routineTemplateId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // Error-only parse; successful deletes return 204 with no JSON body.
    await parseJsonResponse<never>(response, "Request failed", false);
  }
}

export async function listChoreTemplates(signal?: AbortSignal): Promise<ChoreTemplate[]> {
  const response = await fetchWithAuth("/api/templates/chores", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse(response, "Request failed", true, z.array(choreTemplateSchema));
}

export async function createChoreTemplate(input: ChoreTemplateInput): Promise<ChoreTemplate> {
  const response = await fetchWithAuth("/api/templates/chores", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response, "Request failed", false, choreTemplateSchema);
}

export async function updateChoreTemplate(
  choreTemplateId: number,
  input: ChoreTemplateInput,
): Promise<ChoreTemplate> {
  const response = await fetchWithAuth(`/api/templates/chores/${choreTemplateId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response, "Request failed", false, choreTemplateSchema);
}

export async function deleteChoreTemplate(choreTemplateId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/templates/chores/${choreTemplateId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // Error-only parse; successful deletes return 204 with no JSON body.
    await parseJsonResponse<never>(response, "Request failed", false);
  }
}

// --- User Settings ---

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

// --- Analytics ---

export type AnalyticsPeriod = "week" | "month" | "quarter" | "year";

export interface DailyCount {
  date: string;
  completed: number;
  total: number;
  completion_rate: number;
}

export interface ChoreStreak {
  chore_id: number;
  name: string;
  current_streak: number;
  longest_streak: number;
}

export interface SkippedChore {
  chore_id: number;
  name: string;
  skip_count: number;
}

export interface ChoreStats {
  completion_rate: number;
  total_completed: number;
  total_scheduled: number;
  daily_completions: DailyCount[];
  streaks: ChoreStreak[];
  most_skipped: SkippedChore[];
}

export interface DailyAdherence {
  date: string;
  taken: number;
  total: number;
  adherence_rate: number;
}

export interface MedicationAnalyticsStats {
  adherence_rate: number;
  total_taken: number;
  total_scheduled: number;
  daily_adherence: DailyAdherence[];
}

export interface PlannedItemAnalyticsStats {
  completion_rate: number;
  total_completed: number;
  total_scheduled: number;
  daily_completions: DailyCount[];
}

export interface RoutineStreak {
  routine_id: number;
  name: string;
  current_streak: number;
  longest_streak: number;
}

export interface RoutineAnalyticsStats {
  completion_rate: number;
  total_completed: number;
  total_scheduled: number;
  daily_completions: DailyCount[];
  streaks: RoutineStreak[];
}

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  start_date: string;
  end_date: string;
  chores: ChoreStats;
  medications: MedicationAnalyticsStats;
  planned_items: PlannedItemAnalyticsStats;
  routines: RoutineAnalyticsStats;
}

const dailyCountSchema = z.object({
  date: z.string(),
  completed: z.number(),
  total: z.number(),
  completion_rate: z.number(),
});

const analyticsSummarySchema = z.object({
  period: z.enum(["week", "month", "quarter", "year"]),
  start_date: z.string(),
  end_date: z.string(),
  chores: z.object({
    completion_rate: z.number(),
    total_completed: z.number(),
    total_scheduled: z.number(),
    daily_completions: z.array(dailyCountSchema),
    streaks: z.array(z.object({
      chore_id: z.number(),
      name: z.string(),
      current_streak: z.number(),
      longest_streak: z.number(),
    })),
    most_skipped: z.array(z.object({
      chore_id: z.number(),
      name: z.string(),
      skip_count: z.number(),
    })),
  }),
  medications: z.object({
    adherence_rate: z.number(),
    total_taken: z.number(),
    total_scheduled: z.number(),
    daily_adherence: z.array(z.object({
      date: z.string(),
      taken: z.number(),
      total: z.number(),
      adherence_rate: z.number(),
    })),
  }),
  planned_items: z.object({
    completion_rate: z.number(),
    total_completed: z.number(),
    total_scheduled: z.number(),
    daily_completions: z.array(dailyCountSchema),
  }),
  routines: z.object({
    completion_rate: z.number(),
    total_completed: z.number(),
    total_scheduled: z.number(),
    daily_completions: z.array(dailyCountSchema),
    streaks: z.array(z.object({
      routine_id: z.number(),
      name: z.string(),
      current_streak: z.number(),
      longest_streak: z.number(),
    })),
  }),
});

export async function fetchAnalyticsSummary(
  period: AnalyticsPeriod = "week",
  signal?: AbortSignal,
): Promise<AnalyticsSummary> {
  const response = await fetchWithAuth(`/api/analytics/summary?period=${period}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse(response, "Failed to load analytics", true, analyticsSummarySchema);
}

// --- Search ---

export interface RoutineSearchResult {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ChoreSearchResult {
  id: number;
  name: string;
  description: string | null;
  priority: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
}

export interface MedicationSearchResult {
  id: number;
  name: string;
  instructions: string;
  is_active: boolean;
  created_at: string;
}

export interface PlannedItemSearchResult {
  id: number;
  title: string;
  notes: string | null;
  planned_for: string;
  priority: string;
  tags: string[];
  is_done: boolean;
  created_at: string;
}

export interface SearchResponse {
  query: string;
  routine_templates: RoutineSearchResult[];
  chore_templates: ChoreSearchResult[];
  medication_plans: MedicationSearchResult[];
  planned_items: PlannedItemSearchResult[];
}

const searchResponseSchema = z.object({
  query: z.string(),
  routine_templates: z.array(z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    is_active: z.boolean(),
    created_at: z.string(),
  })),
  chore_templates: z.array(z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    priority: z.string(),
    tags: z.array(z.string()),
    is_active: z.boolean(),
    created_at: z.string(),
  })),
  medication_plans: z.array(z.object({
    id: z.number(),
    name: z.string(),
    instructions: z.string(),
    is_active: z.boolean(),
    created_at: z.string(),
  })),
  planned_items: z.array(z.object({
    id: z.number(),
    title: z.string(),
    notes: z.string().nullable(),
    planned_for: z.string(),
    priority: z.string(),
    tags: z.array(z.string()),
    is_done: z.boolean(),
    created_at: z.string(),
  })),
});

export async function searchItems(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  const response = await fetchWithAuth(`/api/search?q=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse(response, "Search failed", true, searchResponseSchema);
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
  return parseJsonResponse(response, "Failed to reschedule item", false, plannedTodayItemSchema);
}
