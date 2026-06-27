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
import {
  medicationHistoryItemSchema,
  medicationMutationResponseSchema,
  medicationTodayItemSchema,
  type MedicationDoseStatus,
  type MedicationHistoryItem,
  type MedicationMutationResponse,
  type MedicationTodayItem,
} from "@/lib/api/medications";
import { z } from "zod";

export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";
export type ChoreStatus = "pending" | "completed" | "skipped";
export type PlannedItemModuleKey =
  | "shopping_list"
  | "meal_planning"
  | "recurring_grocery"
  | "shared_calendar";

export type { MedicationDoseStatus, MedicationHistoryItem, MedicationMutationResponse, MedicationTodayItem };

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
