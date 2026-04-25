export type TaskStatus = 'pending' | 'done' | 'skipped';

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
  id: number;
  title: string;
  overdue_since: string;
}

export interface DueTodayItem {
  task_instance_id: number;
  title: string;
  status: TaskStatus;
  scheduled_date: string;
  due_at: string | null;
}

export interface UpcomingTodayItem {
  id: number;
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

export async function fetchToday(signal?: AbortSignal): Promise<TodayPayload> {
  const response = await fetch('/api/v1/today', {
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unable to load today's data (${response.status})`);
  }

  return (await response.json()) as TodayPayload;
}
