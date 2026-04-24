import { useEffect, useState } from 'react';
import {
  completeChore,
  fetchToday,
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

type SectionItem = {
  id: string;
  title: string;
  subtitle?: string;
  instructions?: string;
  choreInstanceId?: number;
  medicationDoseInstanceId?: number;
  medicationStatus?: string;
};

function TaskActions({
  choreInstanceId,
  onRefresh,
}: {
  choreInstanceId?: number;
  onRefresh: () => Promise<void>;
}) {
  if (!choreInstanceId) {
    return null;
  }

  const onDone = async () => {
    await completeChore(choreInstanceId);
    await onRefresh();
  };

  const onSkip = async () => {
    await skipChore(choreInstanceId);
    await onRefresh();
  };

  const onReschedule = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateValue = tomorrow.toISOString().slice(0, 10);
    await rescheduleChore(choreInstanceId, dateValue);
    await onRefresh();
  };

  return (
    <div className="btn-group btn-group-sm" role="group" aria-label="Task actions">
      <button type="button" className="btn btn-outline-success" onClick={() => void onDone()}>
        Done
      </button>
      <button type="button" className="btn btn-outline-secondary" onClick={() => void onSkip()}>
        Skip
      </button>
      <button type="button" className="btn btn-outline-primary" onClick={() => void onReschedule()}>
        Reschedule
      </button>
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
  if (!medicationDoseInstanceId || medicationStatus !== 'scheduled') {
    return null;
  }

  const onTake = async () => {
    await takeMedicationDose(medicationDoseInstanceId);
    await onRefresh();
  };

  const onSkip = async () => {
    await skipMedicationDose(medicationDoseInstanceId);
    await onRefresh();
  };

  return (
    <div className="btn-group btn-group-sm" role="group" aria-label="Medication actions">
      <button type="button" className="btn btn-outline-success" onClick={() => void onTake()}>
        Taken
      </button>
      <button type="button" className="btn btn-outline-secondary" onClick={() => void onSkip()}>
        Skip
      </button>
    </div>
  );
}

function formatSubtitle(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(' • ');
}

function buildMedicationItems(items: MedicationTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `medication-${item.medication_dose_instance_id}`,
    title: item.name,
    subtitle: formatSubtitle(new Date(item.scheduled_at).toLocaleTimeString(), item.status),
    instructions: item.instructions,
    medicationDoseInstanceId: item.medication_dose_instance_id,
    medicationStatus: item.status,
  }));
}

function buildMedicationHistoryItems(items: MedicationHistoryItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `medication-history-${item.medication_dose_instance_id}`,
    title: item.name,
    subtitle: formatSubtitle(new Date(item.scheduled_at).toLocaleString(), item.status),
    instructions: item.instructions,
  }));
}

function buildRoutineItems(items: RoutineTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `routine-${item.task_instance_id}`,
    title: item.title,
    subtitle: formatSubtitle(item.status, item.scheduled_date, item.due_at ?? undefined),
  }));
}

function buildOverdueItems(items: OverdueTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `overdue-${item.chore_instance_id}`,
    title: item.title,
    subtitle: `Overdue since ${item.overdue_since}`,
    choreInstanceId: item.chore_instance_id,
  }));
}

function buildDueTodayItems(items: DueTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `due-${item.chore_instance_id}`,
    title: item.title,
    subtitle: formatSubtitle(item.status, item.scheduled_date),
    choreInstanceId: item.chore_instance_id,
  }));
}

function buildUpcomingItems(items: UpcomingTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `upcoming-${item.chore_instance_id}`,
    title: item.title,
    subtitle: `Scheduled ${item.scheduled_date}`,
    choreInstanceId: item.chore_instance_id,
  }));
}

function buildPlannedItems(items: PlannedTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `planned-${item.id}`,
    title: item.title,
    subtitle: `${item.is_done ? 'Done' : 'Planned'} for ${item.planned_for}`,
    instructions: item.notes ?? undefined,
  }));
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
      <div className="card-header fw-semibold">{heading}</div>
      <ul className="list-group list-group-flush">
        {items.length === 0 ? (
          <li className="list-group-item text-muted">No items.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="list-group-item d-flex justify-content-between gap-3 align-items-start">
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
                <TaskActions choreInstanceId={item.choreInstanceId} onRefresh={onRefresh} />
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

  const loadToday = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchToday(signal);
      setToday(payload);
    } catch (err) {
      if (signal?.aborted) {
        return;
      }
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
      <h2 className="h4">Today</h2>
      <p className="text-muted">Medication with instructions and history, routines, overdue chores, due today, upcoming, and planned items.</p>

      {isLoading ? <div className="alert alert-info">Loading today...</div> : null}
      {!isLoading && error ? <div className="alert alert-danger">{error}</div> : null}
      {!isLoading && !error && today && !hasAnyItems ? (
        <div className="alert alert-secondary">Nothing scheduled for today yet.</div>
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
