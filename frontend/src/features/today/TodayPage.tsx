import { useEffect, useState } from "react";
import {
  completeRoutineTask,
  completeChore,
  deletePlannedItem,
  fetchToday,
  isRetryableApiError,
  rescheduleChore,
  skipRoutineTask,
  skipChore,
  skipMedicationDose,
  startRoutineTask,
  takeMedicationDose,
  updatePlannedItem,
  type TaskStatus,
  type DueTodayItem,
  type MedicationHistoryItem,
  type MedicationTodayItem,
  type OverdueTodayItem,
  type PlannedTodayItem,
  type RoutineTodayItem,
  type TodayPayload,
  type UpcomingTodayItem,
} from "@/lib/api/today";
import {
  capitalize,
  dayjs,
  formatDate,
  formatDateTime,
  formatTime,
  toIsoDate,
} from "@/lib/dateUtils";

type SectionItem = {
  id: string;
  title: string;
  subtitle?: string;
  instructions?: string;
  statusLabel?: string;
  statusTone?: "primary" | "secondary" | "warning" | "success" | "info" | "danger";
  taskInstanceId?: number;
  taskStatus?: TaskStatus;
  choreInstanceId?: number;
  choreStatus?: string;
  scheduledDate?: string;
  medicationDoseInstanceId?: number;
  medicationStatus?: string;
  plannedItem?: PlannedTodayItem;
};

type BulkAction = {
  key: string;
  label: string;
  buttonClassName: string;
  isAvailable: (item: SectionItem) => boolean;
  run: (item: SectionItem) => Promise<unknown>;
};

function formatSubtitle(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" • ");
}

function buildMedicationItems(items: MedicationTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `medication-${item.medication_dose_instance_id}`,
    title: item.name,
    subtitle: formatSubtitle(formatTime(item.scheduled_at), item.status),
    instructions: item.instructions,
    statusLabel: capitalize(item.status),
    statusTone:
      item.status === "taken"
        ? "success"
        : item.status === "missed"
          ? "danger"
          : item.status === "skipped"
            ? "secondary"
            : "info",
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
    statusLabel: capitalize(item.status),
    statusTone:
      item.status === "taken"
        ? "success"
        : item.status === "missed"
          ? "danger"
          : item.status === "skipped"
            ? "secondary"
            : "info",
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
    statusLabel: capitalize(item.status),
    statusTone:
      item.status === "completed"
        ? "success"
        : item.status === "in_progress"
          ? "primary"
          : item.status === "skipped"
            ? "secondary"
            : "warning",
    taskInstanceId: item.task_instance_id,
    taskStatus: item.status,
  }));
}

function buildOverdueItems(items: OverdueTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `overdue-${item.chore_instance_id}`,
    title: item.title,
    subtitle: `Overdue since ${formatDate(item.overdue_since)}`,
    statusLabel: "Overdue",
    statusTone: "danger",
    choreInstanceId: item.chore_instance_id,
    choreStatus: "pending",
    scheduledDate: item.overdue_since,
  }));
}

function buildDueTodayItems(items: DueTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `due-${item.chore_instance_id}`,
    title: item.title,
    subtitle: formatSubtitle(capitalize(item.status), formatDate(item.scheduled_date)),
    statusLabel: capitalize(item.status),
    statusTone:
      item.status === "completed" ? "success" : item.status === "skipped" ? "secondary" : "warning",
    choreInstanceId: item.chore_instance_id,
    choreStatus: item.status,
    scheduledDate: item.scheduled_date,
  }));
}

function buildUpcomingItems(items: UpcomingTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `upcoming-${item.chore_instance_id}`,
    title: item.title,
    subtitle: `Scheduled ${formatDate(item.scheduled_date)}`,
    statusLabel: "Upcoming",
    statusTone: "primary",
    choreInstanceId: item.chore_instance_id,
    choreStatus: "pending",
    scheduledDate: item.scheduled_date,
  }));
}

function buildPlannedItemPayload(item: PlannedTodayItem, isDone: boolean) {
  return {
    title: item.title,
    planned_for: item.planned_for,
    notes: item.notes,
    module_key: item.module_key,
    recurrence_hint: item.recurrence_hint,
    linked_source: item.linked_source,
    linked_ref: item.linked_ref,
    is_done: isDone,
  };
}

function buildPlannedItems(items: PlannedTodayItem[]): SectionItem[] {
  return items.map((item) => ({
    id: `planned-${item.id}`,
    title: item.title,
    subtitle: formatSubtitle(
      `${item.is_done ? "Done" : "Planned"} for ${item.planned_for}`,
      item.module_key ? `Module: ${item.module_key}` : undefined,
    ),
    instructions: item.notes ?? undefined,
    statusLabel: item.is_done ? "Done" : "Planned",
    statusTone: item.is_done ? "success" : "secondary",
    plannedItem: item,
  }));
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "secondary" | "warning" | "success" | "info" | "danger";
}) {
  return (
    <div className="col-6 col-lg-3">
      <div className="card h-100 border-0 summary-card shadow-sm">
        <div className="card-body py-3">
          <div className={`summary-pill text-bg-${tone}`}>{label}</div>
          <div className="summary-value mt-2">{value}</div>
        </div>
      </div>
    </div>
  );
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
      setActionError(err instanceof Error ? err.message : "Action failed");
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
    const dateValue = toIsoDate(dayjs(scheduledDate).add(1, "day"));
    await rescheduleChore(choreInstanceId, dateValue);
  };

  return (
    <div>
      {actionError ? <small className="text-danger d-block mb-1">{actionError}</small> : null}
      <div className="d-grid gap-2 d-sm-flex" role="group" aria-label="Task actions">
        <button
          type="button"
          className="btn btn-success btn-sm"
          disabled={isSubmitting}
          onClick={() => void runAction(() => completeChore(choreInstanceId))}
        >
          Done
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isSubmitting}
          onClick={() => void runAction(() => skipChore(choreInstanceId))}
        >
          Skip
        </button>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={isSubmitting}
          onClick={() => void runAction(onReschedule)}
        >
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

  if (!medicationDoseInstanceId || medicationStatus !== "scheduled") {
    return null;
  }

  return (
    <div>
      {actionError ? <small className="text-danger d-block mb-1">{actionError}</small> : null}
      <div className="d-grid gap-2 d-sm-flex" role="group" aria-label="Medication actions">
        <button
          type="button"
          className="btn btn-success btn-sm"
          disabled={isSubmitting}
          onClick={() => void runAction(() => takeMedicationDose(medicationDoseInstanceId))}
        >
          Taken
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isSubmitting}
          onClick={() => void runAction(() => skipMedicationDose(medicationDoseInstanceId))}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function RoutineActions({
  taskInstanceId,
  taskStatus,
  onRefresh,
}: {
  taskInstanceId?: number;
  taskStatus?: TaskStatus;
  onRefresh: () => Promise<void>;
}) {
  const { isSubmitting, actionError, runAction } = useAsyncAction(onRefresh);

  if (!taskInstanceId || !taskStatus || taskStatus === "completed" || taskStatus === "skipped") {
    return null;
  }

  return (
    <div>
      {actionError ? <small className="text-danger d-block mb-1">{actionError}</small> : null}
      <div className="d-grid gap-2 d-sm-flex" role="group" aria-label="Routine actions">
        {taskStatus === "pending" ? (
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={isSubmitting}
            onClick={() => void runAction(() => startRoutineTask(taskInstanceId))}
          >
            Start
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-success btn-sm"
          disabled={isSubmitting}
          onClick={() => void runAction(() => completeRoutineTask(taskInstanceId))}
        >
          Done
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isSubmitting}
          onClick={() => void runAction(() => skipRoutineTask(taskInstanceId))}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function PlannedItemActions({
  plannedItem,
  onRefresh,
}: {
  plannedItem?: PlannedTodayItem;
  onRefresh: () => Promise<void>;
}) {
  const { isSubmitting, actionError, runAction } = useAsyncAction(onRefresh);

  if (!plannedItem) {
    return null;
  }

  return (
    <div>
      {actionError ? <small className="text-danger d-block mb-1">{actionError}</small> : null}
      <div className="d-grid gap-2 d-sm-flex" role="group" aria-label="Planned item actions">
        <button
          type="button"
          className={`btn btn-sm ${plannedItem.is_done ? "btn-outline-success" : "btn-success"}`}
          disabled={isSubmitting}
          onClick={() =>
            void runAction(() =>
              updatePlannedItem(
                plannedItem.id,
                buildPlannedItemPayload(plannedItem, !plannedItem.is_done),
              ),
            )
          }
        >
          {plannedItem.is_done ? "Undo" : "Done"}
        </button>
        <button
          type="button"
          className="btn btn-outline-danger btn-sm"
          disabled={isSubmitting}
          onClick={() => void runAction(() => deletePlannedItem(plannedItem.id))}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  heading,
  items,
  onRefresh,
  bulkActions,
}: {
  heading: string;
  items: SectionItem[];
  onRefresh: () => Promise<void>;
  bulkActions?: BulkAction[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{
    tone: "success" | "danger" | "warning";
    text: string;
  } | null>(null);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const selectableItems = bulkActions?.length ? items : [];
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const hasSelectedItems = selectedItems.length > 0;
  const allSelected = selectableItems.length > 0 && selectedIds.length === selectableItems.length;

  const toggleSelected = (itemId: string) => {
    setBulkFeedback(null);
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  };

  const toggleAllSelected = () => {
    setBulkFeedback(null);
    setSelectedIds(allSelected ? [] : selectableItems.map((item) => item.id));
  };

  const runBulkAction = async (action: BulkAction) => {
    const applicableItems = selectedItems.filter((item) => action.isAvailable(item));
    if (applicableItems.length === 0) {
      setBulkFeedback({
        tone: "warning",
        text: `No selected ${heading.toLowerCase()} can be updated with ${action.label.toLowerCase()}.`,
      });
      return;
    }

    setIsBulkSubmitting(true);
    setBulkFeedback(null);
    const results = await Promise.allSettled(applicableItems.map((item) => action.run(item)));
    const successCount = results.filter((result) => result.status === "fulfilled").length;
    const failureCount = results.length - successCount;

    if (successCount > 0) {
      await onRefresh();
      setSelectedIds([]);
    }

    if (failureCount === 0) {
      setBulkFeedback({
        tone: "success",
        text: `${action.label} applied to ${successCount} ${successCount === 1 ? "item" : "items"}.`,
      });
    } else if (successCount === 0) {
      setBulkFeedback({
        tone: "danger",
        text: `${action.label} failed for all ${failureCount} selected ${failureCount === 1 ? "item" : "items"}.`,
      });
    } else {
      setBulkFeedback({
        tone: "warning",
        text: `${action.label} updated ${successCount} ${successCount === 1 ? "item" : "items"} and failed for ${failureCount}.`,
      });
    }

    setIsBulkSubmitting(false);
  };

  return (
    <div className="card mb-3">
      <div className="card-header py-2">
        <div className="d-flex flex-column gap-2">
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <span className="fw-semibold">{heading}</span>
            {bulkActions?.length ? (
              <label className="form-check mb-0 small text-muted">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={allSelected}
                  disabled={isBulkSubmitting || selectableItems.length === 0}
                  onChange={toggleAllSelected}
                />{" "}
                Select all
              </label>
            ) : null}
          </div>
          {bulkActions?.length ? (
            <div className="d-flex flex-column gap-2">
              <div className="d-flex gap-2 flex-wrap">
                {bulkActions.map((action) => {
                  const applicableCount = selectedItems.filter((item) =>
                    action.isAvailable(item),
                  ).length;
                  return (
                    <button
                      key={action.key}
                      type="button"
                      className={`btn btn-sm ${action.buttonClassName}`}
                      disabled={isBulkSubmitting || !hasSelectedItems || applicableCount === 0}
                      onClick={() => void runBulkAction(action)}
                    >
                      {action.label}
                    </button>
                  );
                })}
              </div>
              {bulkFeedback ? (
                <small className={`text-${bulkFeedback.tone}`}>{bulkFeedback.text}</small>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <ul className="list-group list-group-flush">
        {items.length === 0 ? (
          <li className="list-group-item py-2 text-muted">No items.</li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="list-group-item py-2 d-flex justify-content-between gap-3 align-items-start flex-column flex-md-row"
            >
              <div className="d-flex gap-2 align-items-start flex-grow-1">
                {bulkActions?.length ? (
                  <input
                    className="form-check-input mt-1"
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    disabled={isBulkSubmitting}
                    aria-label={`Select ${item.title}`}
                    onChange={() => toggleSelected(item.id)}
                  />
                ) : null}
                <div>
                  <div className="fw-medium">{item.title}</div>
                  {item.instructions ? (
                    <small className="d-block">Instructions: {item.instructions}</small>
                  ) : null}
                  {item.subtitle ? <small className="text-muted">{item.subtitle}</small> : null}
                </div>
              </div>
              {item.statusLabel ? (
                <span
                  className={`badge text-bg-${item.statusTone ?? "secondary"} align-self-start`}
                >
                  {item.statusLabel}
                </span>
              ) : null}
              <div className="d-flex gap-2 align-items-center">
                <MedicationActions
                  medicationDoseInstanceId={item.medicationDoseInstanceId}
                  medicationStatus={item.medicationStatus}
                  onRefresh={onRefresh}
                />
                <RoutineActions
                  taskInstanceId={item.taskInstanceId}
                  taskStatus={item.taskStatus}
                  onRefresh={onRefresh}
                />
                <PlannedItemActions plannedItem={item.plannedItem} onRefresh={onRefresh} />
                <TaskActions
                  choreInstanceId={item.choreInstanceId}
                  scheduledDate={item.scheduledDate}
                  onRefresh={onRefresh}
                />
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
      setError(err instanceof Error ? err.message : "Unable to load today payload.");
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

  const openPlannedCount = today ? today.planned.filter((item) => !item.is_done).length : 0;
  const scheduledMedicationCount = today
    ? today.medication.filter((item) => item.status === "scheduled").length
    : 0;
  const routineOpenCount = today
    ? today.routines.filter((item) => item.status === "pending" || item.status === "in_progress")
        .length
    : 0;
  const routineBulkActions: BulkAction[] = [
    {
      key: "routine-done",
      label: "Bulk Done",
      buttonClassName: "btn-success",
      isAvailable: (item) =>
        Boolean(
          item.taskInstanceId && item.taskStatus !== "completed" && item.taskStatus !== "skipped",
        ),
      run: (item) => completeRoutineTask(item.taskInstanceId as number),
    },
    {
      key: "routine-skip",
      label: "Bulk Skip",
      buttonClassName: "btn-outline-secondary",
      isAvailable: (item) =>
        Boolean(
          item.taskInstanceId && item.taskStatus !== "completed" && item.taskStatus !== "skipped",
        ),
      run: (item) => skipRoutineTask(item.taskInstanceId as number),
    },
  ];
  const choreBulkActions: BulkAction[] = [
    {
      key: "chore-done",
      label: "Bulk Done",
      buttonClassName: "btn-success",
      isAvailable: (item) =>
        Boolean(
          item.choreInstanceId &&
          item.choreStatus !== "completed" &&
          item.choreStatus !== "skipped",
        ),
      run: (item) => completeChore(item.choreInstanceId as number),
    },
    {
      key: "chore-skip",
      label: "Bulk Skip",
      buttonClassName: "btn-outline-secondary",
      isAvailable: (item) =>
        Boolean(
          item.choreInstanceId &&
          item.choreStatus !== "completed" &&
          item.choreStatus !== "skipped",
        ),
      run: (item) => skipChore(item.choreInstanceId as number),
    },
  ];
  const plannedBulkActions: BulkAction[] = [
    {
      key: "planned-done",
      label: "Bulk Done",
      buttonClassName: "btn-success",
      isAvailable: (item) => Boolean(item.plannedItem && !item.plannedItem.is_done),
      run: (item) =>
        updatePlannedItem(item.plannedItem!.id, buildPlannedItemPayload(item.plannedItem!, true)),
    },
    {
      key: "planned-undo",
      label: "Bulk Undo",
      buttonClassName: "btn-outline-success",
      isAvailable: (item) => Boolean(item.plannedItem?.is_done),
      run: (item) =>
        updatePlannedItem(item.plannedItem!.id, buildPlannedItemPayload(item.plannedItem!, false)),
    },
  ];

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">Today</h2>
        <div className="d-flex gap-2 w-100 w-md-auto">
          <button
            className="btn btn-outline-primary btn-sm flex-grow-1 flex-md-grow-0"
            type="button"
            disabled={isLoading}
            onClick={() => void loadToday()}
          >
            Refresh
          </button>
        </div>
      </div>
      <p className="text-muted mb-3">
        Medication, routines, chores, and planned tasks with fast mobile-friendly actions.
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
          <SectionCard
            heading="Medication Today"
            items={buildMedicationItems(today.medication)}
            onRefresh={loadToday}
          />
          <SectionCard
            heading="Medication History"
            items={buildMedicationHistoryItems(today.medication_history)}
            onRefresh={loadToday}
          />
          <SectionCard
            heading="Routines"
            items={buildRoutineItems(today.routines)}
            onRefresh={loadToday}
            bulkActions={routineBulkActions}
          />
          <SectionCard
            heading="Overdue"
            items={buildOverdueItems(today.overdue)}
            onRefresh={loadToday}
            bulkActions={choreBulkActions}
          />
          <SectionCard
            heading="Due Today"
            items={buildDueTodayItems(today.due_today)}
            onRefresh={loadToday}
            bulkActions={choreBulkActions}
          />
          <SectionCard
            heading="Upcoming"
            items={buildUpcomingItems(today.upcoming)}
            onRefresh={loadToday}
            bulkActions={choreBulkActions}
          />
          <SectionCard
            heading="Planned"
            items={buildPlannedItems(today.planned)}
            onRefresh={loadToday}
            bulkActions={plannedBulkActions}
          />
        </>
      ) : null}
    </section>
  );
}
