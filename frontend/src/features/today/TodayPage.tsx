import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as m from "@/paraglide/messages";
import { FeedbackBanner } from "@/components/common/FeedbackBanner";
import { isRetryableApiError } from "@/lib/api/http";
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
import { useTodayLiveUpdates } from "@/features/today/useTodayLiveUpdates";
import { useTodayQuery } from "@/features/today/useTodayQuery";
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";

export function TodayPage() {
  const liveUpdatesError = useTodayLiveUpdates();
  const todayQuery = useTodayQuery();
  const today = todayQuery.data ?? null;
  const isLoading = todayQuery.isLoading;
  const isRefreshing = todayQuery.isFetching && !isLoading;
  const error = todayQuery.error ? apiErrorMessage(todayQuery.error, m.load_today_failed()) : null;
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
        buttonVariant: "success",
        isAvailable: (item) => Boolean(item.taskInstanceId && isItemActionable(item)),
        run: (item) =>
          actions.completeRoutineTask(item.taskInstanceId as number, { refresh: false }),
      },
      {
        key: "routine-skip",
        label: m.action_skip(),
        buttonVariant: "outline-secondary",
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
        buttonVariant: "success",
        isAvailable: (item) => Boolean(item.choreInstanceId && isItemActionable(item)),
        run: (item) => actions.completeChore(item.choreInstanceId as number, { refresh: false }),
      },
      {
        key: "chore-skip",
        label: m.action_skip(),
        buttonVariant: "outline-secondary",
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
        buttonVariant: "success",
        isAvailable: (item) => Boolean(item.plannedItem && isItemActionable(item)),
        run: (item) => actions.togglePlannedItem(item.plannedItem!, true, { refresh: false }),
      },
      {
        key: "planned-undo",
        label: m.action_undo(),
        buttonVariant: "outline-success",
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
      // Loaded on the moment it fires; offline without a cached copy it is skipped.
      void import("canvas-confetti")
        .then(({ default: confetti }) =>
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } }),
        )
        .catch(() => {});
    }
    prevActionableRef.current = actionableCount;
  }, [actionableCount, hasAnyItems]);

  return (
    <section>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
        <h2 className="text-h4 font-medium mb-0">{m.nav_today()}</h2>
        <div className="flex gap-2 items-start flex-wrap w-full">
          <Button
            variant="outline-primary"
            size="sm"
            className="md:grow-0"
            disabled={isLoading || isRefreshing}
            onClick={() => void loadToday()}
          >
            {isRefreshing ? <Spinner className="me-1" role="status" /> : null}
            {m.action_refresh()}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground mb-4">{m.today_subtitle()}</p>

      <FeedbackBanner message={isLoading ? m.today_loading() : null} tone="info" />
      <FeedbackBanner message={liveUpdatesError} tone="warning" />
      {!isLoading && error ? (
        <Alert variant="danger" className="py-2 flex justify-between items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <Button variant="danger" size="sm" onClick={() => void loadToday()}>
              {m.action_retry()}
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {!isLoading && !error && today && !hasAnyItems ? (
        <Alert
          variant="secondary"
          className="py-2 flex justify-between items-center gap-2 flex-wrap"
        >
          <span>{m.today_nothing_scheduled()}</span>
          <Link to="/templates" className={buttonVariants({ size: "sm" })}>
            {m.today_create_first_chore()}
          </Link>
        </Alert>
      ) : null}

      {!isLoading && !error && today ? (
        <>
          <div className="grid grid-cols-12 gap-4 mb-4 lg:grid-cols-5">
            <SummaryCard
              label={m.today_summary_overdue()}
              value={today.overdue.length}
              tone="danger"
            />
            <SummaryCard
              label={m.today_summary_due_today()}
              value={today.due_today.length}
              tone="warning"
            />
            <SummaryCard
              label={m.today_summary_medication_due()}
              value={scheduledMedicationCount}
              tone="info"
            />
            <SummaryCard
              label={m.today_summary_open_plans()}
              value={openPlannedCount}
              tone="primary"
            />
            <SummaryCard
              label={m.today_summary_open_routines()}
              value={routineOpenCount}
              tone="secondary"
            />
          </div>
          <WebFocusPanel sections={sections} />
          <PlannedSection
            items={today.planned}
            onRefresh={loadToday}
            bulkActions={plannedBulkActions}
          />
          {sections
            .filter((section) => section.key !== "planned")
            .map((section) => (
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
