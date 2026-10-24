import { Repeat } from "lucide-react";
import { useEffect, useState } from "react";
import * as m from "@/paraglide/messages";
import {
  type DueTodayItem,
  type MedicationHistoryItem,
  type MedicationTodayItem,
  type OverdueTodayItem,
  type PlannedItemEditScope,
  type PlannedTodayItem,
  type RoutineTodayItem,
  type SectionItem,
  type StatusTone,
  type TaskStatus,
  type UpcomingTodayItem,
} from "@/lib/api/today";
import { capitalize, formatDate, formatDateTime, formatTime } from "@/lib/dateUtils";
import { FeedbackBanner } from "@/components/common/FeedbackBanner";
import { useTodayActions } from "@/features/today/useTodayActions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge, badgeColors } from "@/components/ui/badge";
import { Button, buttonVariants, type ButtonVariant } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ListGroup, ListGroupItem } from "@/components/ui/list-group";

export type BulkAction = {
  key: string;
  label: string;
  buttonVariant: ButtonVariant;
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
  if (item.medicationDoseInstanceId)
    return item.medicationStatus === "scheduled" || item.medicationStatus === "missed";
  if (item.taskInstanceId) return item.taskStatus !== "completed" && item.taskStatus !== "skipped";
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
    subtitle: m.today_overdue_since({ date: formatDate(item.overdue_since) }),
    statusLabel: m.today_section_overdue(),
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
    subtitle: m.today_scheduled_on({ date: formatDate(item.scheduled_date) }),
    statusLabel: m.today_section_upcoming(),
    statusTone: "primary",
    choreInstanceId: item.chore_instance_id,
    choreStatus: "pending",
    scheduledDate: item.scheduled_date,
  }));
}

export function buildPlannedItems(items: PlannedTodayItem[]): SectionItem[] {
  return [...items]
    .sort((a, b) => {
      if (a.time_of_day && b.time_of_day) return a.time_of_day.localeCompare(b.time_of_day);
      if (a.time_of_day) return -1;
      if (b.time_of_day) return 1;
      return 0;
    })
    .map((item) => ({
      id: `planned-${item.id}`,
      title: item.time_of_day ? `${item.time_of_day.slice(0, 5)} · ${item.title}` : item.title,
      isRecurring: Boolean(item.rrule || item.recurrence_series_id),
      subtitle: formatSubtitle(
        item.is_done
          ? m.today_planned_done_for({ date: formatDate(item.planned_for) })
          : m.today_planned_for({ date: formatDate(item.planned_for) }),
        item.module_key ? m.today_planned_module({ key: item.module_key }) : undefined,
      ),
      instructions: item.notes ?? undefined,
      statusLabel: item.is_done ? m.search_done() : m.search_planned(),
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
    <div className="col-span-6 sm:col-span-4 lg:col-span-1">
      <Card className="h-full border-0 summary-card shadow-sm">
        <CardContent className="py-4">
          <div className={cn("summary-pill", badgeColors(tone))}>{label}</div>
          <div className="summary-value mt-2">{value}</div>
        </CardContent>
      </Card>
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
    <Card className="border-0 shadow-sm mb-4 web-focus-panel">
      <CardContent>
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          <div>
            <div className="uppercase text-muted-foreground text-small font-semibold">
              {m.today_focus_panel_title()}
            </div>
            <h3 className="text-h5 font-medium mb-1">
              {nextItem ? nextItem.title : m.today_focus_all_clear()}
            </h3>
            <p className="text-muted-foreground mb-0">
              {nextItem
                ? m.today_focus_next_attention({ heading: nextSection?.heading ?? "Today" })
                : m.today_focus_no_open_actions()}
            </p>
          </div>
          <div
            className="focus-progress"
            aria-label={`${completionPercent}% ${m.today_focus_complete()}`}
          >
            <span className="focus-progress-value">{completionPercent}%</span>
            <span className="text-muted-foreground text-small">{m.today_focus_complete()}</span>
          </div>
        </div>
        <Progress className="my-4" value={completionPercent} aria-label={m.today_completion()} />
        <div className="flex gap-2 flex-wrap">
          {sections.map((section) => {
            const actionable = getActionableCount(section.items);
            return (
              <a
                key={section.key}
                className={buttonVariants({
                  variant: actionable > 0 ? "outline-primary" : "outline-secondary",
                  size: "sm",
                })}
                href={`#${section.key}`}
              >
                {section.heading}
                <Badge variant="light" className="ms-2">
                  {actionable}
                </Badge>
              </a>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
      {actions.actionError ? (
        <small className="text-danger block mb-1">{actions.actionError}</small>
      ) : null}
      <div className="grid gap-2 sm:flex" role="group" aria-label={m.today_task_actions()}>
        <Button
          variant="success"
          size="sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.completeChore(choreInstanceId)}
        >
          {m.action_done()}
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.skipChore(choreInstanceId)}
        >
          {m.action_skip()}
        </Button>
        <Button
          variant="outline-primary"
          size="sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.rescheduleChoreByOneDay(choreInstanceId, scheduledDate)}
        >
          {m.action_reschedule_1_day()}
        </Button>
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

  if (
    !medicationDoseInstanceId ||
    (medicationStatus !== "scheduled" && medicationStatus !== "missed")
  ) {
    return null;
  }

  return (
    <div>
      {actions.actionError ? (
        <small className="text-danger block mb-1">{actions.actionError}</small>
      ) : null}
      <div className="grid gap-2 sm:flex" role="group" aria-label={m.today_medication_actions()}>
        <Button
          variant="success"
          size="sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.takeMedicationDose(medicationDoseInstanceId)}
        >
          {m.action_taken()}
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.skipMedicationDose(medicationDoseInstanceId)}
        >
          {m.action_skip()}
        </Button>
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
      {actions.actionError ? (
        <small className="text-danger block mb-1">{actions.actionError}</small>
      ) : null}
      <div className="grid gap-2 sm:flex" role="group" aria-label={m.today_routine_actions()}>
        {taskStatus === "pending" ? (
          <Button
            variant="outline-primary"
            size="sm"
            disabled={actions.isSubmitting}
            onClick={() => void actions.startRoutineTask(taskInstanceId)}
          >
            {m.action_start()}
          </Button>
        ) : null}
        <Button
          variant="success"
          size="sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.completeRoutineTask(taskInstanceId)}
        >
          {m.action_done()}
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.skipRoutineTask(taskInstanceId)}
        >
          {m.action_skip()}
        </Button>
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
  const [editScope, setEditScope] = useState<PlannedItemEditScope>("this");
  const actions = useTodayActions(onRefresh);

  const openEdit = () => {
    if (!plannedItem) return;
    setEditTitle(plannedItem.title);
    setEditPlannedFor(plannedItem.planned_for);
    setEditNotes(plannedItem.notes ?? "");
    setEditScope("this");
    actions.clearActionError();
    setIsEditing(true);
  };

  const onSave = async () => {
    if (!plannedItem || !editTitle.trim()) return;
    await actions.editPlannedItem(
      plannedItem,
      {
        title: editTitle.trim(),
        planned_for: editPlannedFor,
        notes: editNotes.trim() || null,
        module_key: plannedItem.module_key,
        recurrence_hint: plannedItem.recurrence_hint,
        rrule: plannedItem.rrule,
        linked_source: plannedItem.linked_source,
        linked_ref: plannedItem.linked_ref,
      },
      editScope,
    );
    setIsEditing(false);
  };

  if (!plannedItem) {
    return null;
  }

  if (isEditing) {
    return (
      <div className="border border-border rounded-md p-2 flex flex-col gap-2 min-w-56">
        <Input
          size="sm"
          value={editTitle}
          placeholder={m.today_title_placeholder()}
          autoFocus
          disabled={actions.isSubmitting}
          onChange={(e) => setEditTitle(e.target.value)}
        />
        <Input
          size="sm"
          type="date"
          value={editPlannedFor}
          disabled={actions.isSubmitting}
          onChange={(e) => setEditPlannedFor(e.target.value)}
        />
        <Input
          size="sm"
          value={editNotes}
          placeholder={m.today_notes_optional()}
          disabled={actions.isSubmitting}
          onChange={(e) => setEditNotes(e.target.value)}
        />
        {plannedItem.rrule || plannedItem.recurrence_series_id ? (
          <Select
            size="sm"
            value={editScope}
            disabled={actions.isSubmitting}
            onChange={(e) => setEditScope(e.target.value as PlannedItemEditScope)}
            aria-label={m.calendar_planned_edit_scope_label()}
          >
            <option value="this">{m.calendar_planned_edit_scope_this()}</option>
            <option value="future">{m.calendar_planned_edit_scope_future()}</option>
            <option value="all">{m.calendar_planned_edit_scope_all()}</option>
          </Select>
        ) : null}
        {actions.actionError ? <small className="text-danger">{actions.actionError}</small> : null}
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={actions.isSubmitting || !editTitle.trim()}
            onClick={() => void onSave()}
          >
            {actions.isSubmitting ? m.action_saving() : m.action_save()}
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            disabled={actions.isSubmitting}
            onClick={() => {
              setIsEditing(false);
              actions.clearActionError();
            }}
          >
            {m.action_cancel()}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {actions.actionError ? (
        <small className="text-danger block mb-1">{actions.actionError}</small>
      ) : null}
      <div className="grid gap-2 sm:flex" role="group" aria-label={m.today_planned_item_actions()}>
        <Button
          variant={plannedItem.is_done ? "outline-success" : "success"}
          size="sm"
          disabled={actions.isSubmitting}
          onClick={() => void actions.togglePlannedItem(plannedItem, !plannedItem.is_done)}
        >
          {plannedItem.is_done ? m.action_undo() : m.action_done()}
        </Button>
        <Button
          variant="outline-secondary"
          size="sm"
          disabled={actions.isSubmitting}
          onClick={openEdit}
        >
          {m.action_edit()}
        </Button>
        {plannedItem.rrule || plannedItem.recurrence_series_id ? (
          <>
            <Button
              variant="outline-danger"
              size="sm"
              disabled={actions.isSubmitting}
              onClick={() => void actions.deletePlannedItem(plannedItem.id, "this")}
            >
              {m.planned_delete_this()}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={actions.isSubmitting}
              onClick={() => void actions.deletePlannedItem(plannedItem.id, "future")}
            >
              {m.calendar_delete_this_and_future()}
            </Button>
          </>
        ) : (
          <Button
            variant="outline-danger"
            size="sm"
            disabled={actions.isSubmitting}
            onClick={() => void actions.deletePlannedItem(plannedItem.id)}
          >
            {m.action_delete()}
          </Button>
        )}
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
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  };

  const toggleAllSelected = () => {
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
        text: m.today_bulk_action_success({ action: action.label, count: successCount }),
      });
    } else if (successCount === 0) {
      setBulkFeedback({
        tone: "danger",
        text: m.today_bulk_action_failed({ action: action.label, count: failureCount }),
      });
    } else {
      setBulkFeedback({
        tone: "warning",
        text: m.today_bulk_action_partial({ action: action.label, successCount, failureCount }),
      });
    }

    setIsBulkSubmitting(false);
  };

  return (
    <Card className="mb-4" id={sectionId}>
      <CardHeader className="py-2">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <span className="font-semibold">{heading}</span>
            {bulkActions?.length ? (
              <label className="check-row mb-0 text-small text-muted-foreground">
                <Checkbox
                  checked={allSelected}
                  disabled={isBulkSubmitting || selectableItems.length === 0}
                  onChange={toggleAllSelected}
                />{" "}
                {m.today_select_all()}
              </label>
            ) : null}
          </div>
          {bulkActions?.length ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                {bulkActions.map((action) => {
                  const applicableCount = selectedItems.filter((item) =>
                    action.isAvailable(item),
                  ).length;
                  return (
                    <Button
                      key={action.key}
                      variant={action.buttonVariant}
                      size="sm"
                      disabled={isBulkSubmitting || !hasSelectedItems || applicableCount === 0}
                      onClick={() => void runBulkAction(action)}
                    >
                      {action.label}
                    </Button>
                  );
                })}
              </div>
              <FeedbackBanner
                message={bulkFeedback?.text ?? null}
                tone={bulkFeedback?.tone}
                onDismiss={() => setBulkFeedback(null)}
              />
            </div>
          ) : null}
        </div>
      </CardHeader>
      <ListGroup flush render={<ul />}>
        {items.length === 0 ? (
          <ListGroupItem render={<li />} className="py-2 text-muted-foreground">
            {m.today_no_items()}
          </ListGroupItem>
        ) : (
          items.map((item) => (
            <ListGroupItem
              render={<li />}
              className="py-2 flex justify-between gap-4 items-start flex-col md:flex-row"
              key={item.id}
            >
              <div className="flex gap-2 items-start grow">
                {bulkActions?.length ? (
                  <Checkbox
                    className="mt-1"
                    checked={selectedIds.includes(item.id)}
                    disabled={isBulkSubmitting}
                    aria-label={m.today_select_item({ title: item.title })}
                    onChange={() => toggleSelected(item.id)}
                  />
                ) : null}
                <div>
                  <div className="font-medium flex items-center gap-1">
                    {item.isRecurring ? (
                      <Repeat
                        className="inline size-4 text-muted-foreground"
                        role="img"
                        aria-label={m.today_recurring()}
                      />
                    ) : null}
                    {item.title}
                  </div>
                  {item.instructions ? (
                    <small className="block">
                      {m.today_instructions({ text: item.instructions })}
                    </small>
                  ) : null}
                  {item.subtitle ? (
                    <small className="text-muted-foreground">{item.subtitle}</small>
                  ) : null}
                </div>
              </div>
              {item.statusLabel ? (
                <Badge variant={item.statusTone ?? "secondary"} className="self-start">
                  {item.statusLabel}
                </Badge>
              ) : null}
              <div className="flex gap-2 items-center">
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
            </ListGroupItem>
          ))
        )}
      </ListGroup>
    </Card>
  );
}
