import confetti from "canvas-confetti";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as m from "@/paraglide/messages";
import { isRetryableApiError } from "@/lib/api/today";
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
import { useTodayQuery } from "@/features/today/useTodayQuery";

export function TodayPage() {
  const todayQuery = useTodayQuery();
  const today = todayQuery.data ?? null;
  const isLoading = todayQuery.isLoading;
  const error = todayQuery.error ? (todayQuery.error instanceof Error ? todayQuery.error.message : "Unable to load today payload.") : null;
  const canRetry = todayQuery.error ? isRetryableApiError(todayQuery.error) : false;
  const loadToday = useCallback(async () => {
    await todayQuery.refetch();
  }, [todayQuery]);

  const actions = useTodayActions();
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
        label: m.action_done(),
        buttonClassName: "btn-success",
        isAvailable: (item) => Boolean(item.taskInstanceId && isItemActionable(item)),
        run: (item) => actions.completeRoutineTask(item.taskInstanceId as number, { refresh: false }),
      },
      {
        key: "routine-skip",
        label: m.action_skip(),
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
        label: m.action_done(),
        buttonClassName: "btn-success",
        isAvailable: (item) => Boolean(item.choreInstanceId && isItemActionable(item)),
        run: (item) => actions.completeChore(item.choreInstanceId as number, { refresh: false }),
      },
      {
        key: "chore-skip",
        label: m.action_skip(),
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
        label: m.action_done(),
        buttonClassName: "btn-success",
        isAvailable: (item) => Boolean(item.plannedItem && isItemActionable(item)),
        run: (item) => actions.togglePlannedItem(item.plannedItem!, true, { refresh: false }),
      },
      {
        key: "planned-undo",
        label: m.action_undo(),
        buttonClassName: "btn-outline-success",
        isAvailable: (item) => Boolean(item.plannedItem && isItemCompleted(item)),
        run: (item) => actions.togglePlannedItem(item.plannedItem!, false, { refresh: false }),
      },
    ],
    [actions],
  );

  const prevActionableRef = useRef<number | null>(null);
  const sections: TodaySection[] = today
    ? [
        {
          key: "medication-today",
          heading: m.today_section_medication(),
          items: buildMedicationItems(today.medication),
        },
        {
          key: "medication-history",
          heading: m.today_section_medication_history(),
          items: buildMedicationHistoryItems(today.medication_history),
        },
        {
          key: "routines",
          heading: m.today_section_routines(),
          items: buildRoutineItems(today.routines),
          bulkActions: routineBulkActions,
        },
        {
          key: "overdue",
          heading: m.today_section_overdue(),
          items: buildOverdueItems(today.overdue),
          bulkActions: choreBulkActions,
        },
        {
          key: "due-today",
          heading: m.today_section_due_today(),
          items: buildDueTodayItems(today.due_today),
          bulkActions: choreBulkActions,
        },
        {
          key: "planned",
          heading: m.today_section_planned(),
          items: buildPlannedItems(today.planned),
          bulkActions: plannedBulkActions,
        },
        {
          key: "upcoming",
          heading: m.today_section_upcoming(),
          items: buildUpcomingItems(today.upcoming),
          bulkActions: choreBulkActions,
        },
      ]
    : [];

  const actionableCount = sections.flatMap((s) => s.items).filter(isItemActionable).length;

  useEffect(() => {
    if (
      hasAnyItems &&
      actionableCount === 0 &&
      prevActionableRef.current !== null &&
      prevActionableRef.current > 0
    ) {
      void confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
    prevActionableRef.current = actionableCount;
  }, [actionableCount, hasAnyItems]);

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">{m.nav_today()}</h2>
        <div className="d-flex gap-2 align-items-start flex-wrap w-100 w-md-auto">
          <button
            className="btn btn-outline-primary btn-sm flex-md-grow-0"
            type="button"
            disabled={isLoading}
            onClick={() => void loadToday()}
          >
            {m.action_refresh()}
          </button>
        </div>
      </div>
      <p className="text-muted mb-3">
        {m.today_subtitle()}
      </p>

      {isLoading ? <div className="alert alert-info py-2">{m.today_loading()}</div> : null}
      {!isLoading && error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void loadToday()}
            >
              {m.action_retry()}
            </button>
          ) : null}
        </div>
      ) : null}
      {!isLoading && !error && today && !hasAnyItems ? (
        <div className="alert alert-secondary py-2">{m.today_nothing_scheduled()}</div>
      ) : null}

      {!isLoading && !error && today ? (
        <>
          <div className="row g-3 mb-3">
            <SummaryCard label={m.today_summary_overdue()} value={today.overdue.length} tone="danger" />
            <SummaryCard label={m.today_summary_due_today()} value={today.due_today.length} tone="warning" />
            <SummaryCard label={m.today_summary_medication_due()} value={scheduledMedicationCount} tone="info" />
            <SummaryCard label={m.today_summary_open_plans()} value={openPlannedCount} tone="primary" />
            <SummaryCard label={m.today_summary_open_routines()} value={routineOpenCount} tone="secondary" />
          </div>
          <WebFocusPanel sections={sections} />
          <PlannedSection
            items={today.planned}
            onRefresh={loadToday}
            bulkActions={plannedBulkActions}
          />
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
        </>
      ) : null}
    </section>
  );
}
