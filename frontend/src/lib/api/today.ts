export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type ChoreStatus = 'pending' | 'completed' | 'skipped';
export type MedicationDoseStatus = 'scheduled' | 'taken' | 'skipped' | 'missed';

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
  is_done: boolean;
}

export interface UnifiedDayItem {
  item_type: 'routine' | 'chore' | 'medication' | 'planned';
  item_id: number;
  title: string;
  status: string;
  scheduled_at: string | null;
  scheduled_date: string | null;
  detail: string | null;
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
}

export interface MedicationMutationResponse {
  medication_dose_instance_id: number;
  status: MedicationDoseStatus;
  scheduled_date: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function fetchToday(signal?: AbortSignal): Promise<TodayPayload> {
  const response = await fetch('/api/v1/today', {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unable to load today's data (${response.status})`);
  }

  return (await response.json()) as TodayPayload;
}

export async function fetchCalendarMonth(year: number, month: number, signal?: AbortSignal): Promise<CalendarMonthPayload> {
  const response = await fetch(`/api/v1/calendar/month?year=${year}&month=${month}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  return parseJsonResponse<CalendarMonthPayload>(response);
}

export async function fetchCalendarDay(date: string, signal?: AbortSignal): Promise<CalendarDayPayload> {
  const response = await fetch(`/api/v1/calendar/day?date=${encodeURIComponent(date)}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  return parseJsonResponse<CalendarDayPayload>(response);
}

export async function createPlannedItem(input: {
  title: string;
  planned_for: string;
  notes?: string | null;
}): Promise<PlannedTodayItem> {
  const response = await fetch('/api/v1/planned-items', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<PlannedTodayItem>(response);
}

export async function completeChore(choreInstanceId: number): Promise<ChoreMutationResponse> {
  const response = await fetch(`/api/v1/chores/${choreInstanceId}/complete`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  return parseJsonResponse<ChoreMutationResponse>(response);
}

export async function skipChore(choreInstanceId: number): Promise<ChoreMutationResponse> {
  const response = await fetch(`/api/v1/chores/${choreInstanceId}/skip`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  return parseJsonResponse<ChoreMutationResponse>(response);
}

export async function rescheduleChore(choreInstanceId: number, scheduledDate: string): Promise<ChoreMutationResponse> {
  const response = await fetch(`/api/v1/chores/${choreInstanceId}/reschedule`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scheduled_date: scheduledDate }),
  });
  return parseJsonResponse<ChoreMutationResponse>(response);
}

export async function takeMedicationDose(medicationDoseId: number): Promise<MedicationMutationResponse> {
  const response = await fetch(`/api/v1/medication-doses/${medicationDoseId}/take`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  return parseJsonResponse<MedicationMutationResponse>(response);
}

export async function skipMedicationDose(medicationDoseId: number): Promise<MedicationMutationResponse> {
  const response = await fetch(`/api/v1/medication-doses/${medicationDoseId}/skip`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  return parseJsonResponse<MedicationMutationResponse>(response);
}
