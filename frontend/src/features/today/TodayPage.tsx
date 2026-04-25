import { useEffect, useState } from 'react';
import {
  completeChore,
  fetchToday,
  isRetryableApiError,
  rescheduleChore,
  skipChore,
  skipMedicationDose,
  takeMedicationDose,
  type DueTodayItem,
  type MedicationHistoryItem,
  type MedicationTodayItem,
  type OverdueTodayItem,
  type PlannedTodayItem,
  type RoutineTodayItem,
  type TodayPayload,
  type UpcomingTodayItem,
} from '../../lib/api/today';
import { capitalize, dayjs, formatDate, formatDateTime, formatTime, toIsoDate } from '../../lib/dateUtils';

type SectionItem = {
  id: string;
  title: string;
  subtitle?: string;
  instructions?: string;
  choreInstanceId?: number;
  scheduledDate?: string;
  medicationDoseInstanceId?: number;
  medicationStatus?: string;
};

function formatSubtitle(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(' • ');
}

function buildMedicationItems(items: MedicationTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `medication-${item.medication_dose_instance_id}`,
    title: item.name,
    subtitle: formatSubtitle(formatTime(item.scheduled_at), item.status),
    instructions: item.instructions,
    medicationDoseInstanceId: item.medication_dose_instance_id,
    medicationStatus: item.status,
  }));
}

function buildMedicationHistoryItems(items: MedicationHistoryItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `medication-history-${item.medication_dose_instance_id}`,
    title: item.name,
    subtitle: formatSubtitle(formatDateTime(item.scheduled_at), item.status),
    instructions: item.instructions,
  }));
}

function buildRoutineItems(items: RoutineTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `routine-${item.task_instance_id}`,
    title: item.title,
    subtitle: formatSubtitle(
      capitalize(item.status),
      formatDate(item.scheduled_date),
      item.due_at ? formatTime(item.due_at) : undefined,
    ),
  }));
}

function buildOverdueItems(items: OverdueTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `overdue-${item.chore_instance_id}`,
    title: item.title,
    subtitle: `Overdue since ${formatDate(item.overdue_since)}`,
    choreInstanceId: item.chore_instance_id,
    scheduledDate: item.overdue_since,
  }));
}

function buildDueTodayItems(items: DueTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `due-${item.chore_instance_id}`,
    title: item.title,
    subtitle: formatSubtitle(capitalize(item.status), formatDate(item.scheduled_date)),
    choreInstanceId: item.chore_instance_id,
    scheduledDate: item.scheduled_date,
  }));
}

function buildUpcomingItems(items: UpcomingTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `upcoming-${item.chore_instance_id}`,
    title: item.title,
    subtitle: `Scheduled ${formatDate(item.scheduled_date)}`,
    choreInstanceId: item.chore_instance_id,
    scheduledDate: item.scheduled_date,
  }));
}

function buildPlannedItems(items: PlannedTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `planned-${item.id}`,
    title: item.title,
    subtitle: formatSubtitle(`${item.is_done ? 'Done' : 'Planned'} for ${item.planned_for}`, item.module_key ? `Module: ${item.module_key}` : undefined),
    instructions: item.notes ?? undefined,
  }));
}

function useAsyncAction(onRefresh: () => Promise<void>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const runAction = async (action: () => Promise<unknown>) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await action();
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return { isSubmitting, actionError, runAction };
}

function TaskActions({
  choreInstanceId,
  scheduledDate,
  onRefresh,
}: {
  choreInstanceId?: number;
  scheduledDate?: string;
  onRefresh: () => Promise<void>;
}) {
  const { isSubmitting, actionError, runAction } = useAsyncAction(onRefresh);

  if (!choreInstanceId || !scheduledDate) {
    return null;
  }

  const onReschedule = async () => {
    const dateValue = toIsoDate(dayjs(scheduledDate).add(1, 'day'));
    await rescheduleChore(choreInstanceId, dateValue);
  };

  return (
    <div>
      {actionError ? <small className="text-danger d-block mb-1">{actionError}</small> : null}
      <div className="d-grid gap-2 d-sm-flex" role="group" aria-label="Task actions">
        <button type="button" className="btn btn-success btn-sm" disabled={isSubmitting} onClick={() => void runAction(() => completeChore(choreInstanceId))}>
          Done
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={isSubmitting} onClick={() => void runAction(() => skipChore(choreInstanceId))}>
          Skip
        </button>
        <button type="button" className="btn btn-outline-primary btn-sm" disabled={isSubmitting} onClick={() => void runAction(onReschedule)}>
          +1 day
        </button>
      </div>
    </div>
  );
}

function MedicationActions({
  medicationDoseInstanceId,
  medicationStatus,
  onRefresh,
}: {
  medicationDoseInstanceId?: number;
  medicationStatus?: string;
  onRefresh: () => Promise<void>;
}) {
  const { isSubmitting, actionError, runAction } = useAsyncAction(onRefresh);

  if (!medicationDoseInstanceId || medicationStatus !== 'scheduled') {
    return null;
  }

  return (
    <div>
      {actionError ? <small className="text-danger d-block mb-1">{actionError}</small> : null}
      <div className="d-grid gap-2 d-sm-flex" role="group" aria-label="Medication actions">
        <button type="button" className="btn btn-success btn-sm" disabled={isSubmitting} onClick={() => void runAction(() => takeMedicationDose(medicationDoseInstanceId))}>
          Taken
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={isSubmitting} onClick={() => void runAction(() => skipMedicationDose(medicationDoseInstanceId))}>
          Skip
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  heading,
  items,
  onRefresh,
}: {
  heading: string;
  items: SectionItem[];
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="card mb-3">
      <div className="card-header py-2 fw-semibold">{heading}</div>
      <ul className="list-group list-group-flush">
        {items.length === 0 ? (
          <li className="list-group-item py-2 text-muted">No items.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="list-group-item py-2 d-flex justify-content-between gap-3 align-items-start flex-column flex-md-row">
              <div>
                <div className="fw-medium">{item.title}</div>
                {item.instructions ? <small className="d-block">Instructions: {item.instructions}</small> : null}
                {item.subtitle ? <small className="text-muted">{item.subtitle}</small> : null}
              </div>
              <div className="d-flex gap-2 align-items-center">
                <MedicationActions
                  medicationDoseInstanceId={item.medicationDoseInstanceId}
                  medicationStatus={item.medicationStatus}
                  onRefresh={onRefresh}
                />
                <TaskActions choreInstanceId={item.choreInstanceId} scheduledDate={item.scheduledDate} onRefresh={onRefresh} />
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function TodayPage() {
  const [today, setToday] = useState<TodayPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  const loadToday = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    setCanRetry(false);
    try {
      const payload = await fetchToday(signal);
      setToday(payload);
    } catch (err) {
      if (signal?.aborted) {
        return;
      }
      setCanRetry(isRetryableApiError(err));
      setError(err instanceof Error ? err.message : 'Unable to load today payload.');
      setToday(null);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadToday(controller.signal);
    return () => {
      controller.abort();
    };
  }, []);

  const hasAnyItems = today
    ? Object.values(today).some((section) => Array.isArray(section) && section.length > 0)
    : false;

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">Today</h2>
        <div className="d-flex gap-2 w-100 w-md-auto">
          <button className="btn btn-outline-primary btn-sm flex-grow-1 flex-md-grow-0" type="button" disabled={isLoading} onClick={() => void loadToday()}>
            Refresh
          </button>
        </div>
      </div>
      <p className="text-muted mb-3">Medication, routines, chores, and planned tasks with fast mobile-friendly actions.</p>

      {isLoading ? <div className="alert alert-info py-2">Loading today...</div> : null}
      {!isLoading && error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void loadToday()}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {!isLoading && !error && today && !hasAnyItems ? (
        <div className="alert alert-secondary py-2">Nothing scheduled for today yet.</div>
      ) : null}

      {!isLoading && !error && today ? (
        <>
          <SectionCard heading="Medication Today" items={buildMedicationItems(today.medication)} onRefresh={loadToday} />
          <SectionCard heading="Medication History" items={buildMedicationHistoryItems(today.medication_history)} onRefresh={loadToday} />
          <SectionCard heading="Routines" items={buildRoutineItems(today.routines)} onRefresh={loadToday} />
          <SectionCard heading="Overdue" items={buildOverdueItems(today.overdue)} onRefresh={loadToday} />
          <SectionCard heading="Due Today" items={buildDueTodayItems(today.due_today)} onRefresh={loadToday} />
          <SectionCard heading="Upcoming" items={buildUpcomingItems(today.upcoming)} onRefresh={loadToday} />
          <SectionCard heading="Planned" items={buildPlannedItems(today.planned)} onRefresh={loadToday} />
        </>
      ) : null}
    </section>
  );
}
