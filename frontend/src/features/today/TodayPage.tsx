import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchToday, isRetryableApiError, type TodayPayload } from "@/lib/api/today";
import { PlannedSection } from "@/features/today/PlannedSection";
import {
  SectionCard,
  SummaryCard,
  WebFocusPanel,
  buildPlannedItems,
  buildDueTodayItems,
  buildMedicationHistoryItems,
  buildMedicationItems,
  buildOverdueItems,
  buildRoutineItems,
  buildUpcomingItems,
  isItemActionable,
  isItemCompleted,
  type BulkAction,
  type TodaySection,
} from "@/features/today/TodaySections";
import { useTodayActions } from "@/features/today/useTodayActions";

export function TodayPage() {
  const [today, setToday] = useState<TodayPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  const loadToday = useCallback(async (signal?: AbortSignal) => {
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
      setError(err instanceof Error ? err.message : "Unable to load today payload.");
      setToday(null);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadToday(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadToday]);

  const actions = useTodayActions(loadToday);
  const hasAnyItems = today
    ? Object.values(today).some((section) => Array.isArray(section) && section.length > 0)
    : false;
  const openPlannedCount = today ? today.planned.filter((item) => !item.is_done).length : 0;
  const scheduledMedicationCount = today
    ? today.medication.filter((item) => item.status === "scheduled").length
    : 0;
  const routineOpenCount = today
    ? today.routines.filter((item) => item.status === "pending" || item.status === "in_progress")
        .length
    : 0;

  const routineBulkActions: BulkAction[] = useMemo(
    () => [
      {
        key: "routine-done",
        label: "Bulk Done",
        buttonClassName: "btn-success",
        isAvailable: (item) => Boolean(item.taskInstanceId && isItemActionable(item)),
        run: (item) => actions.completeRoutineTask(item.taskInstanceId as number, { refresh: false }),
      },
      {
        key: "routine-skip",
        label: "Bulk Skip",
        buttonClassName: "btn-outline-secondary",
        isAvailable: (item) => Boolean(item.taskInstanceId && isItemActionable(item)),
        run: (item) => actions.skipRoutineTask(item.taskInstanceId as number, { refresh: false }),
      },
    ],
    [actions],
  );

  const choreBulkActions: BulkAction[] = useMemo(
    () => [
      {
        key: "chore-done",
        label: "Bulk Done",
        buttonClassName: "btn-success",
        isAvailable: (item) => Boolean(item.choreInstanceId && isItemActionable(item)),
        run: (item) => actions.completeChore(item.choreInstanceId as number, { refresh: false }),
      },
      {
        key: "chore-skip",
        label: "Bulk Skip",
        buttonClassName: "btn-outline-secondary",
        isAvailable: (item) => Boolean(item.choreInstanceId && isItemActionable(item)),
        run: (item) => actions.skipChore(item.choreInstanceId as number, { refresh: false }),
      },
    ],
    [actions],
  );

  const plannedBulkActions: BulkAction[] = useMemo(
    () => [
      {
        key: "planned-done",
        label: "Bulk Done",
        buttonClassName: "btn-success",
        isAvailable: (item) => Boolean(item.plannedItem && isItemActionable(item)),
        run: (item) => actions.togglePlannedItem(item.plannedItem!, true, { refresh: false }),
      },
      {
        key: "planned-undo",
        label: "Bulk Undo",
        buttonClassName: "btn-outline-success",
        isAvailable: (item) => Boolean(item.plannedItem && isItemCompleted(item)),
        run: (item) => actions.togglePlannedItem(item.plannedItem!, false, { refresh: false }),
      },
    ],
    [actions],
  );

  const sections: TodaySection[] = today
    ? [
        {
          key: "medication-today",
          heading: "Medication Today",
          items: buildMedicationItems(today.medication),
        },
        {
          key: "medication-history",
          heading: "Medication History",
          items: buildMedicationHistoryItems(today.medication_history),
        },
        {
          key: "routines",
          heading: "Routines",
          items: buildRoutineItems(today.routines),
          bulkActions: routineBulkActions,
        },
        {
          key: "overdue",
          heading: "Overdue",
          items: buildOverdueItems(today.overdue),
          bulkActions: choreBulkActions,
        },
        {
          key: "due-today",
          heading: "Due Today",
          items: buildDueTodayItems(today.due_today),
          bulkActions: choreBulkActions,
        },
        {
          key: "planned",
          heading: "Planned",
          items: buildPlannedItems(today.planned),
          bulkActions: plannedBulkActions,
        },
        {
          key: "upcoming",
          heading: "Upcoming",
          items: buildUpcomingItems(today.upcoming),
          bulkActions: choreBulkActions,
        },
      ]
    : [];

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">Today</h2>
        <div className="d-flex gap-2 align-items-start flex-wrap w-100 w-md-auto">
          <button
            className="btn btn-outline-primary btn-sm flex-md-grow-0"
            type="button"
            disabled={isLoading}
            onClick={() => void loadToday()}
          >
            Refresh
          </button>
        </div>
      </div>
      <p className="text-muted mb-3">
        Medication, routines, chores, and planned tasks — everything due or active today.
      </p>

      {isLoading ? <div className="alert alert-info py-2">Loading today...</div> : null}
      {!isLoading && error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void loadToday()}
            >
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
          <div className="row g-3 mb-3">
            <SummaryCard label="Overdue" value={today.overdue.length} tone="danger" />
            <SummaryCard label="Due Today" value={today.due_today.length} tone="warning" />
            <SummaryCard label="Medication Due" value={scheduledMedicationCount} tone="info" />
            <SummaryCard label="Open Plans" value={openPlannedCount} tone="primary" />
            <SummaryCard label="Open Routines" value={routineOpenCount} tone="secondary" />
          </div>
          <WebFocusPanel sections={sections} />
          {sections.filter((section) => section.key !== "planned").map((section) => (
            <SectionCard
              key={section.key}
              sectionId={section.key}
              heading={section.heading}
              items={section.items}
              onRefresh={loadToday}
              bulkActions={section.bulkActions}
            />
          ))}
          <PlannedSection
            items={today.planned}
            onRefresh={loadToday}
            bulkActions={plannedBulkActions}
          />
        </>
      ) : null}
    </section>
  );
}
