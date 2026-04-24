export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type ChoreStatus = 'pending' | 'completed' | 'skipped';

export interface MedicationTodayItem {
  id: number;
  name: string;
  due_at: string | null;
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
}

export interface TodayPayload {
  medication: MedicationTodayItem[];
  routines: RoutineTodayItem[];
  overdue: OverdueTodayItem[];
  due_today: DueTodayItem[];
  upcoming: UpcomingTodayItem[];
  planned: PlannedTodayItem[];
}

export interface ChoreMutationResponse {
  chore_instance_id: number;
  status: ChoreStatus;
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
