import { useEffect, useState } from "react";
import {
  type DueTodayItem,
  type MedicationHistoryItem,
  type MedicationTodayItem,
  type OverdueTodayItem,
  type PlannedTodayItem,
  type RoutineTodayItem,
  type SectionItem,
  type StatusTone,
  type TaskStatus,
  type UpcomingTodayItem,
} from "@/lib/api/today";
import { capitalize, formatDate, formatDateTime, formatTime } from "@/lib/dateUtils";
import { useTodayActions } from "@/features/today/useTodayActions";

export type BulkAction = {
  key: string;
  label: string;
  buttonClassName: string;
  isAvailable: (item: SectionItem) => boolean;
  run: (item: SectionItem) => Promise<unknown>;
};

export type TodaySection = {
  key: string;
  heading: string;
  items: SectionItem[];
  bulkActions?: BulkAction[];
};

export function isItemActionable(item: SectionItem): boolean {
  if (item.medicationDoseInstanceId) return item.medicationStatus === "scheduled" || item.medicationStatus === "missed";
  if (item.taskInstanceId)
    return item.taskStatus !== "completed" && item.taskStatus !== "skipped";
  if (item.choreInstanceId)
    return item.choreStatus !== "completed" && item.choreStatus !== "skipped";
  if (item.plannedItem) return !item.plannedItem.is_done;
  return false;
}

export function isItemCompleted(item: SectionItem): boolean {
  if (item.medicationDoseInstanceId) return item.medicationStatus === "taken";
  if (item.taskInstanceId) return item.taskStatus === "completed";
  if (item.choreInstanceId) return item.choreStatus === "completed";
  if (item.plannedItem) return item.plannedItem.is_done;
  return false;
}

function getActionableCount(items: SectionItem[]): number {
  return items.filter(isItemActionable).length;
}

function getCompletedCount(items: SectionItem[]): number {
  return items.filter(isItemCompleted).length;
}

function formatSubtitle(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" • ");
}

export function buildMedicationItems(items: MedicationTodayItem[]): SectionItem[] {
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

export function buildMedicationHistoryItems(items: MedicationHistoryItem[]): SectionItem[] {
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

export function buildRoutineItems(items: RoutineTodayItem[]): SectionItem[] {
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

export function buildOverdueItems(items: OverdueTodayItem[]): SectionItem[] {
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

export function buildDueTodayItems(items: DueTodayItem[]): SectionItem[] {
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

export function buildUpcomingItems(items: UpcomingTodayItem[]): SectionItem[] {
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

export function buildPlannedItems(items: PlannedTodayItem[]): SectionItem[] {
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

export function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: StatusTone;
}) {
  return (
    <div className="col-6 col-sm-4 col-lg">
      <div className="card h-100 border-0 summary-card shadow-sm">
        <div className="card-body py-3">
          <div className={`summary-pill text-bg-${tone}`}>{label}</div>
          <div className="summary-value mt-2">{value}</div>
        </div>
      </div>
    </div>
  );
}

export function WebFocusPanel({ sections }: { sections: TodaySection[] }) {
  const actionableCount = sections.reduce(
    (total, section) => total + getActionableCount(section.items),
    0,
  );
  const completedCount = sections.reduce(
    (total, section) => total + getCompletedCount(section.items),
    0,
  );
  const totalTrackedCount = actionableCount + completedCount;
  const completionPercent =
    totalTrackedCount > 0 ? Math.round((completedCount / totalTrackedCount) * 100) : 0;
  const nextSection = sections.find((section) => getActionableCount(section.items) > 0);
  const nextItem = nextSection?.items.find(isItemActionable);

  return (
    <div className="card border-0 shadow-sm mb-3 web-focus-panel">
      <div className="card-body">
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
          <div>
            <div className="text-uppercase text-muted small fw-semibold">Today's focus</div>
            <h3 className="h5 mb-1">{nextItem ? nextItem.title : "All clear for now"}</h3>
            <p className="text-muted mb-0">
              {nextItem
                ? `${nextSection?.heading ?? "Today"} is the next section that needs attention.`
                : "No open actions remain for today."}
            </p>
          </div>
          <div className="focus-progress" aria-label={`${completionPercent}% complete`}>
            <span className="focus-progress-value">{completionPercent}%</span>
            <span className="text-muted small">complete</span>
          </div>
        </div>
        <div
          className="progress my-3"
          role="progressbar"
          aria-label="Today completion"
          aria-valuenow={completionPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress-bar" style={{ width: `${completionPercent}%` }} />
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {sections.map((section) => {
            const actionable = getActionableCount(section.items);
            return (
              <a
                key={section.key}
                className={`btn btn-sm ${actionable > 0 ? "btn-outline-primary" : "btn-outline-secondary"}`}
                href={`#${section.key}`}
              >
                {section.heading}
                <span className="badge text-bg-light ms-2">{actionable}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
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
  const actions = useTodayActions(onRefresh);

  if (!choreInstanceId || !scheduledDate) {
    return null;
  }

  return (
    <div>
      {actions.actionError ? <small className="text-danger d-block mb-1">{actions.actionError}</small> : null}
      <div className="d-grid gap-2 d-sm-flex" role="group" aria-label="Task actions">
        <button
          type="button"
          className="btn btn-success btn-sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.completeChore(choreInstanceId)}
        >
          Done
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.skipChore(choreInstanceId)}
        >
          Skip
        </button>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.rescheduleChoreByOneDay(choreInstanceId, scheduledDate)}
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
  const actions = useTodayActions(onRefresh);

  if (!medicationDoseInstanceId || (medicationStatus !== "scheduled" && medicationStatus !== "missed")) {
    return null;
  }

  return (
    <div>
      {actions.actionError ? <small className="text-danger d-block mb-1">{actions.actionError}</small> : null}
      <div className="d-grid gap-2 d-sm-flex" role="group" aria-label="Medication actions">
        <button
          type="button"
          className="btn btn-success btn-sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.takeMedicationDose(medicationDoseInstanceId)}
        >
          Taken
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.skipMedicationDose(medicationDoseInstanceId)}
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
  const actions = useTodayActions(onRefresh);

  if (!taskInstanceId || !taskStatus || taskStatus === "completed" || taskStatus === "skipped") {
    return null;
  }

  return (
    <div>
      {actions.actionError ? <small className="text-danger d-block mb-1">{actions.actionError}</small> : null}
      <div className="d-grid gap-2 d-sm-flex" role="group" aria-label="Routine actions">
        {taskStatus === "pending" ? (
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={actions.isSubmitting}
            onClick={() => void actions.startRoutineTask(taskInstanceId)}
          >
            Start
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-success btn-sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.completeRoutineTask(taskInstanceId)}
        >
          Done
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.skipRoutineTask(taskInstanceId)}
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
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPlannedFor, setEditPlannedFor] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const actions = useTodayActions(onRefresh);

  const openEdit = () => {
    if (!plannedItem) return;
    setEditTitle(plannedItem.title);
    setEditPlannedFor(plannedItem.planned_for);
    setEditNotes(plannedItem.notes ?? "");
    actions.clearActionError();
    setIsEditing(true);
  };

  const onSave = async () => {
    if (!plannedItem || !editTitle.trim()) return;
    await actions.editPlannedItem(plannedItem, {
      title: editTitle.trim(),
      planned_for: editPlannedFor,
      notes: editNotes.trim() || null,
      module_key: plannedItem.module_key,
      recurrence_hint: plannedItem.recurrence_hint,
      linked_source: plannedItem.linked_source,
      linked_ref: plannedItem.linked_ref,
    });
    setIsEditing(false);
  };

  if (!plannedItem) {
    return null;
  }

  if (isEditing) {
    return (
      <div className="border rounded p-2 d-flex flex-column gap-2" style={{ minWidth: "14rem" }}>
        <input
          className="form-control form-control-sm"
          value={editTitle}
          placeholder="Title"
          autoFocus
          disabled={actions.isSubmitting}
          onChange={(e) => setEditTitle(e.target.value)}
        />
        <input
          className="form-control form-control-sm"
          type="date"
          value={editPlannedFor}
          disabled={actions.isSubmitting}
          onChange={(e) => setEditPlannedFor(e.target.value)}
        />
        <input
          className="form-control form-control-sm"
          value={editNotes}
          placeholder="Notes (optional)"
          disabled={actions.isSubmitting}
          onChange={(e) => setEditNotes(e.target.value)}
        />
        {actions.actionError ? <small className="text-danger">{actions.actionError}</small> : null}
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={actions.isSubmitting || !editTitle.trim()}
            onClick={() => void onSave()}
          >
            {actions.isSubmitting ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={actions.isSubmitting}
            onClick={() => {
              setIsEditing(false);
              actions.clearActionError();
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {actions.actionError ? <small className="text-danger d-block mb-1">{actions.actionError}</small> : null}
      <div className="d-grid gap-2 d-sm-flex" role="group" aria-label="Planned item actions">
        <button
          type="button"
          className={`btn btn-sm ${plannedItem.is_done ? "btn-outline-success" : "btn-success"}`}
          disabled={actions.isSubmitting}
          onClick={() => void actions.togglePlannedItem(plannedItem, !plannedItem.is_done)}
        >
          {plannedItem.is_done ? "Undo" : "Done"}
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={actions.isSubmitting}
          onClick={openEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-outline-danger btn-sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.deletePlannedItem(plannedItem.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function SectionCard({
  sectionId,
  heading,
  items,
  onRefresh,
  bulkActions,
}: {
  sectionId: string;
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
    <div className="card mb-3" id={sectionId}>
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
