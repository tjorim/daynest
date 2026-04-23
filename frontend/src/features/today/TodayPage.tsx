import { useEffect, useState } from 'react';
import {
  fetchToday,
  type DueTodayItem,
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
  isTask: boolean;
};

const STUB_ACTION = () => {
  // TODO: wire to task mutation endpoints.
};

function TaskActions() {
  return (
    <div className="btn-group btn-group-sm" role="group" aria-label="Task actions">
      <button type="button" className="btn btn-outline-success" onClick={STUB_ACTION}>
        Done
      </button>
      <button type="button" className="btn btn-outline-secondary" onClick={STUB_ACTION}>
        Skip
      </button>
      <button type="button" className="btn btn-outline-primary" onClick={STUB_ACTION}>
        Reschedule
      </button>
    </div>
  );
}

function formatSubtitle(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(' • ');
}

function buildMedicationItems(items: MedicationTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `medication-${item.id}`,
    title: item.name,
    subtitle: item.due_at ? `Due ${new Date(item.due_at).toLocaleTimeString()}` : undefined,
    isTask: false,
  }));
}

function buildRoutineItems(items: RoutineTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `routine-${item.task_instance_id}`,
    title: item.title,
    subtitle: formatSubtitle(item.status, item.scheduled_date, item.due_at ?? undefined),
    isTask: true,
  }));
}

function buildOverdueItems(items: OverdueTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `overdue-${item.id}`,
    title: item.title,
    subtitle: `Overdue since ${item.overdue_since}`,
    isTask: true,
  }));
}

function buildDueTodayItems(items: DueTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `due-${item.task_instance_id}`,
    title: item.title,
    subtitle: formatSubtitle(item.status, item.scheduled_date, item.due_at ?? undefined),
    isTask: true,
  }));
}

function buildUpcomingItems(items: UpcomingTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `upcoming-${item.id}`,
    title: item.title,
    subtitle: `Scheduled ${item.scheduled_date}`,
    isTask: false,
  }));
}

function buildPlannedItems(items: PlannedTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `planned-${item.id}`,
    title: item.title,
    subtitle: `Planned for ${item.planned_for}`,
    isTask: false,
  }));
}

function SectionCard({
  heading,
  items,
}: {
  heading: string;
  items: SectionItem[];
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
                {item.subtitle ? <small className="text-muted">{item.subtitle}</small> : null}
              </div>
              {item.isTask ? <TaskActions /> : null}
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

  useEffect(() => {
    const controller = new AbortController();

    async function loadToday() {
      setIsLoading(true);
      setError(null);
      try {
        const payload = await fetchToday(controller.signal);
        setToday(payload);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load today payload.');
        setToday(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadToday();

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
      <p className="text-muted">Medication, routines, overdue chores, due today, upcoming, and planned items.</p>

      {isLoading ? <div className="alert alert-info">Loading today...</div> : null}
      {!isLoading && error ? <div className="alert alert-danger">{error}</div> : null}
      {!isLoading && !error && today && !hasAnyItems ? (
        <div className="alert alert-secondary">Nothing scheduled for today yet.</div>
      ) : null}

      {!isLoading && !error && today ? (
        <>
          <SectionCard heading="Medication" items={buildMedicationItems(today.medication)} />
          <SectionCard heading="Routines" items={buildRoutineItems(today.routines)} />
          <SectionCard heading="Overdue" items={buildOverdueItems(today.overdue)} />
          <SectionCard heading="Due Today" items={buildDueTodayItems(today.due_today)} />
          <SectionCard heading="Upcoming" items={buildUpcomingItems(today.upcoming)} />
          <SectionCard heading="Planned" items={buildPlannedItems(today.planned)} />
        </>
      ) : null}
    </section>
  );
}
