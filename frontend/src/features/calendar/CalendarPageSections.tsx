import { useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import type { Dayjs } from "dayjs";
import * as m from "@/paraglide/messages";
import { capitalize, formatDate, toIsoDate } from "@/lib/dateUtils";
import { type CalendarDayPayload, type CalendarMonthDaySummary, type PlannedItemModuleKey, type PlannedTodayItem } from "@/lib/api/today";

function itemBadgeClass(itemType: string): string {
  if (itemType === "medication") return "text-bg-info";
  if (itemType === "routine") return "text-bg-primary";
  if (itemType === "chore") return "text-bg-warning";
  return "text-bg-secondary";
}

function dayItemStatusClass(status: string): string {
  if (status === "done" || status === "completed" || status === "taken") return "text-bg-success";
  if (status === "pending") return "text-bg-warning";
  if (status === "scheduled") return "text-bg-info";
  if (status === "missed") return "text-bg-danger";
  return "text-bg-secondary";
}

function formatPlannedMeta(item: PlannedTodayItem): string {
  const timeAndDuration = [
    item.time_of_day ? item.time_of_day.slice(0, 5) : null,
    item.duration_minutes ? `${item.duration_minutes} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const values = [
    timeAndDuration || null,
    item.is_done ? m.search_done() : m.search_planned(),
    item.module_key ? m.calendar_module_label({ key: item.module_key }) : null,
    item.rrule || item.recurrence_series_id ? "🔁 Repeats" : null,
    item.recurrence_hint ? `Repeat: ${item.recurrence_hint}` : null,
    item.linked_source ? `Source: ${item.linked_source}` : null,
  ];

  return values.filter(Boolean).join(" • ");
}

const WEEKDAYS = [
  m.calendar_weekday_mon,
  m.calendar_weekday_tue,
  m.calendar_weekday_wed,
  m.calendar_weekday_thu,
  m.calendar_weekday_fri,
  m.calendar_weekday_sat,
  m.calendar_weekday_sun,
];

const WEEKDAY_REPEAT_OPTIONS = [
  { code: "MO", label: m.calendar_weekday_mon },
  { code: "TU", label: m.calendar_weekday_tue },
  { code: "WE", label: m.calendar_weekday_wed },
  { code: "TH", label: m.calendar_weekday_thu },
  { code: "FR", label: m.calendar_weekday_fri },
  { code: "SA", label: m.calendar_weekday_sat },
  { code: "SU", label: m.calendar_weekday_sun },
] as const;

export function MonthNavigationControls({
  onRefresh,
  onPrevMonth,
  onCurrentMonth,
  onNextMonth,
}: {
  onRefresh: () => void;
  onPrevMonth: () => void;
  onCurrentMonth: () => void;
  onNextMonth: () => void;
}) {
  return (
    <div className="d-flex flex-column gap-2 mb-2">
      <div className="d-flex justify-content-between align-items-center">
        <h2 className="h4 mb-0">{m.calendar_title()}</h2>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={onRefresh}>
          {m.action_refresh()}
        </button>
      </div>
      <div className="btn-group btn-group-sm w-100" role="group" aria-label="Quick month controls">
        <button type="button" className="btn btn-outline-secondary" onClick={onPrevMonth}>
          {m.calendar_prev()}
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={onCurrentMonth}>
          {m.calendar_this_month()}
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={onNextMonth}>
          {m.calendar_next()}
        </button>
      </div>
    </div>
  );
}

export function CalendarMonthGrid({
  monthStart,
  monthItems,
  selectedDate,
  onSelectDate,
  onDropReschedule,
}: {
  monthStart: Dayjs;
  monthItems: CalendarMonthDaySummary[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onDropReschedule?: (itemId: number, date: string) => void;
}) {
  const daysInMonth = monthStart.daysInMonth();
  const leadingEmptyDays = (monthStart.day() + 6) % 7;
  const totalCalendarCells = Math.ceil((leadingEmptyDays + daysInMonth) / 7) * 7;
  const itemsByDate = useMemo(() => new Map(monthItems.map((item) => [item.date, item])), [monthItems]);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  return (
    <div className="card">
      <div className="card-body p-2 p-md-3">
        <div className="row row-cols-7 g-1 g-md-2">
          {WEEKDAYS.map((wd) => (
            <div key={wd()} className="col text-center small fw-semibold text-muted">
              {wd()}
            </div>
          ))}
          {Array.from({ length: totalCalendarCells }).map((_, idx) => {
            const dayNumber = idx - leadingEmptyDays + 1;
            if (dayNumber < 1 || dayNumber > daysInMonth) {
              return <div key={`empty-${idx}`} className="col" aria-hidden="true" />;
            }
            const dateValue = toIsoDate(monthStart.date(dayNumber));
            const summary = itemsByDate.get(dateValue);
            const selected = selectedDate === dateValue;
            const isDragTarget = !selected && dragOverDate === dateValue;
            const cellClass = `btn w-100 text-start py-2 ${selected ? "btn-primary" : isDragTarget ? "btn-outline-success" : "btn-outline-secondary"}`;
            return (
              <div key={dateValue} className="col">
                <button
                  type="button"
                  className={cellClass}
                  onClick={() => onSelectDate(dateValue)}
                  data-date={dateValue}
                  onDragOver={onDropReschedule ? (e) => { e.preventDefault(); setDragOverDate(dateValue); } : undefined}
                  onDragLeave={onDropReschedule ? () => setDragOverDate(null) : undefined}
                  onDrop={onDropReschedule ? (e) => {
                    e.preventDefault();
                    setDragOverDate(null);
                    const rawId = e.dataTransfer.getData("plannedItemId");
                    const itemId = parseInt(rawId, 10);
                    if (!isNaN(itemId)) onDropReschedule(itemId, dateValue);
                  } : undefined}
                >
                  <div className="fw-semibold lh-1">{dayNumber}</div>
                  <small>{summary ? m.calendar_n_items({ count: summary.total }) : m.calendar_no_items()}</small>
                  {summary ? (
                    <div className="calendar-cell-meta mt-2">
                      {summary.routines ? (
                        <span className="badge text-bg-primary-subtle text-primary-emphasis">
                          {summary.routines}R
                        </span>
                      ) : null}
                      {summary.chores ? (
                        <span className="badge text-bg-warning-subtle text-warning-emphasis">
                          {summary.chores}C
                        </span>
                      ) : null}
                      {summary.medications ? (
                        <span className="badge text-bg-info-subtle text-info-emphasis">
                          {summary.medications}M
                        </span>
                      ) : null}
                      {summary.planned ? (
                        <span className="badge text-bg-secondary">{summary.planned}P</span>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DayDetailsPanel({
  selectedDate,
  dayItems,
  isAdding,
  onStartRoutine,
  onCompleteRoutine,
  onSkipRoutine,
  onCompleteChore,
  onSkipChore,
  onRescheduleChore,
}: {
  selectedDate: string;
  dayItems: CalendarDayPayload["items"];
  isAdding: boolean;
  onStartRoutine: (itemId: number) => Promise<void>;
  onCompleteRoutine: (itemId: number) => Promise<void>;
  onSkipRoutine: (itemId: number) => Promise<void>;
  onCompleteChore: (itemId: number) => Promise<void>;
  onSkipChore: (itemId: number) => Promise<void>;
  onRescheduleChore: (itemId: number, scheduledDate: string) => Promise<void>;
}) {
  return (
    <div className="card mb-3">
      <div className="card-header fw-semibold py-2">{m.calendar_day_details_header({ date: formatDate(selectedDate) })}</div>
      <ul className="list-group list-group-flush">
        {dayItems.length === 0 ? (
          <li className="list-group-item py-2 text-muted">{m.calendar_no_items_for_day()}</li>
        ) : (
          dayItems.map((item) => (
            <li key={`${item.item_type}-${item.item_id}`} className="list-group-item py-2">
              <div className="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <div className="fw-semibold">
                    {item.rrule || item.recurrence_series_id ? "🔁 " : ""}
                    {item.title}
                  </div>
                  <small className="text-muted">{capitalize(item.status)}</small>
                  {item.detail ? <small className="d-block">{item.detail}</small> : null}
                  {item.module_key ? (
                    <small className="d-block text-muted">{m.calendar_module_label({ key: item.module_key })}</small>
                  ) : null}
                  <div className="d-flex gap-2 flex-wrap mt-2">
                    {item.item_type === "routine" && item.status === "pending" ? (
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        disabled={isAdding}
                        onClick={() => void onStartRoutine(item.item_id)}
                      >
                        {m.action_start()}
                      </button>
                    ) : null}
                    {item.item_type === "routine" &&
                    item.status !== "completed" &&
                    item.status !== "skipped" ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          disabled={isAdding}
                          onClick={() => void onCompleteRoutine(item.item_id)}
                        >
                          {m.action_done()}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={isAdding}
                          onClick={() => void onSkipRoutine(item.item_id)}
                        >
                          {m.action_skip()}
                        </button>
                      </>
                    ) : null}
                    {item.item_type === "chore" && item.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          disabled={isAdding}
                          onClick={() => void onCompleteChore(item.item_id)}
                        >
                          {m.action_done()}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={isAdding}
                          onClick={() => void onSkipChore(item.item_id)}
                        >
                          {m.action_skip()}
                        </button>
                        {item.scheduled_date ? (
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            disabled={isAdding}
                            onClick={() =>
                              void onRescheduleChore(item.item_id, item.scheduled_date as string)
                            }
                          >
                            {m.action_reschedule_1_day()}
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="d-grid gap-1 text-end">
                  <span className={`badge ${itemBadgeClass(item.item_type)}`}>{item.item_type}</span>
                  <span className={`badge ${dayItemStatusClass(item.status)}`}>
                    {capitalize(item.status)}
                  </span>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function PlannedItemsSidebar({
  selectedDate,
  plannedItems,
  title,
  timeOfDay,
  durationMinutes,
  notes,
  moduleKey,
  recurrenceHint,
  isRepeating,
  repeatPreset,
  repeatWeekdays,
  customInterval,
  linkedSource,
  linkedRef,
  editingPlannedItemId,
  confirmDeleteId,
  isAdding,
  addError,
  onSetTitle,
  onSetTimeOfDay,
  onSetDurationMinutes,
  onSetNotes,
  onSetModuleKey,
  onSetRecurrenceHint,
  onSetIsRepeating,
  onSetRepeatPreset,
  onSetRepeatWeekdays,
  onSetCustomInterval,
  onSetLinkedSource,
  onSetLinkedRef,
  onAddPlanned,
  onCancelEdit,
  onToggleDone,
  onStartEdit,
  onSetConfirmDeleteId,
  onRemovePlannedItem,
  isExporting,
  isImporting,
  backupStatus,
  fileInputRef,
  onExportBackup,
  onImportFile,
  onDropReschedule,
}: {
  selectedDate: string;
  plannedItems: PlannedTodayItem[];
  title: string;
  timeOfDay: string;
  durationMinutes: number | null;
  notes: string;
  moduleKey: PlannedItemModuleKey | "";
  recurrenceHint: string;
  isRepeating: boolean;
  repeatPreset: "daily" | "weekly" | "monthly" | "custom";
  repeatWeekdays: string[];
  customInterval: number;
  linkedSource: string;
  linkedRef: string;
  editingPlannedItemId: number | null;
  confirmDeleteId: number | null;
  isAdding: boolean;
  addError: string | null;
  onSetTitle: (value: string) => void;
  onSetTimeOfDay: (value: string) => void;
  onSetDurationMinutes: (value: number | null) => void;
  onSetNotes: (value: string) => void;
  onSetModuleKey: (value: PlannedItemModuleKey | "") => void;
  onSetRecurrenceHint: (value: string) => void;
  onSetIsRepeating: (value: boolean) => void;
  onSetRepeatPreset: (value: "daily" | "weekly" | "monthly" | "custom") => void;
  onSetRepeatWeekdays: (value: string[]) => void;
  onSetCustomInterval: (value: number) => void;
  onSetLinkedSource: (value: string) => void;
  onSetLinkedRef: (value: string) => void;
  onAddPlanned: () => Promise<void>;
  onCancelEdit: () => void;
  onToggleDone: (item: PlannedTodayItem) => Promise<void>;
  onStartEdit: (item: PlannedTodayItem) => void;
  onSetConfirmDeleteId: (id: number | null) => void;
  onRemovePlannedItem: (itemId: number, scope?: "this" | "future") => Promise<void>;
  isExporting: boolean;
  isImporting: boolean;
  backupStatus: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onExportBackup: () => Promise<void>;
  onImportFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDropReschedule?: (itemId: number, date: string) => void;
}) {
  const touchCloneRef = useRef<HTMLElement | null>(null);
  return (
    <>
      <div className="card mb-3">
        <div className="card-header fw-semibold py-2">{m.calendar_quick_add_header()}</div>
        <div className="card-body d-grid gap-3">
          <div className="d-grid gap-2">
            <input
              className="form-control"
              value={title}
              onChange={(event) => onSetTitle(event.target.value)}
              placeholder={m.calendar_plan_title_placeholder()}
            />
            <label htmlFor="planned-time-of-day" className="form-label mt-2 mb-1">
              {m.calendar_time_of_day_label()}
            </label>
            <input
              id="planned-time-of-day"
              type="time"
              className="form-control"
              value={timeOfDay}
              onChange={(event) => onSetTimeOfDay(event.target.value)}
            />
            <label htmlFor="planned-duration-minutes" className="form-label mt-2 mb-1">
              {m.calendar_duration_label()}
            </label>
            <input
              id="planned-duration-minutes"
              type="number"
              className="form-control"
              min={1}
              value={durationMinutes ?? ""}
              onChange={(event) =>
                onSetDurationMinutes(event.target.value === "" ? null : Number(event.target.value))
              }
              placeholder={m.calendar_duration_placeholder()}
            />
            <textarea
              className="form-control"
              rows={3}
              value={notes}
              onChange={(event) => onSetNotes(event.target.value)}
              placeholder={m.calendar_notes_placeholder()}
            />
            <select
              className="form-select"
              value={moduleKey}
              onChange={(event) => onSetModuleKey(event.target.value as PlannedItemModuleKey | "")}
              aria-label="Optional module"
            >
              <option value="">{m.calendar_module_general()}</option>
              <option value="shopping_list">{m.calendar_module_shopping()}</option>
              <option value="meal_planning">{m.calendar_module_meal()}</option>
              <option value="recurring_grocery">{m.calendar_module_grocery()}</option>
              <option value="shared_calendar">{m.calendar_module_shared()}</option>
            </select>
            <div className="form-check">
              <input
                id="planned-repeat-toggle"
                className="form-check-input"
                type="checkbox"
                checked={isRepeating}
                onChange={(event) => onSetIsRepeating(event.target.checked)}
              />
              <label className="form-check-label" htmlFor="planned-repeat-toggle">
                Repeat
              </label>
            </div>
            {isRepeating ? (
              <div className="d-grid gap-2 border rounded p-2">
                <select
                  className="form-select"
                  value={repeatPreset}
                  onChange={(event) =>
                    onSetRepeatPreset(event.target.value as "daily" | "weekly" | "monthly" | "custom")
                  }
                  aria-label="Repeat schedule"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom interval</option>
                </select>
                {repeatPreset === "weekly" ? (
                  <div className="d-flex flex-wrap gap-2">
                    {WEEKDAY_REPEAT_OPTIONS.map((weekday) => (
                      <label key={weekday.code} className="form-check form-check-inline mb-0">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={repeatWeekdays.includes(weekday.code)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              onSetRepeatWeekdays([...repeatWeekdays, weekday.code]);
                              return;
                            }
                            const next = repeatWeekdays.filter((value) => value !== weekday.code);
                            onSetRepeatWeekdays(next);
                          }}
                        />
                        <span className="form-check-label">{weekday.label()}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
                {repeatPreset === "custom" ? (
                  <div className="input-group">
                    <span className="input-group-text">Every</span>
                    <input
                      type="number"
                      className="form-control"
                      min={2}
                      value={customInterval}
                      onChange={(event) =>
                        onSetCustomInterval(Math.max(2, Number(event.target.value || 2)))
                      }
                    />
                    <span className="input-group-text">days</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <input
                className="form-control"
                value={recurrenceHint}
                onChange={(event) => onSetRecurrenceHint(event.target.value)}
                placeholder={m.calendar_recurrence_placeholder()}
              />
            )}
            <input
              className="form-control"
              value={linkedSource}
              onChange={(event) => onSetLinkedSource(event.target.value)}
              placeholder={m.calendar_linked_source_placeholder()}
            />
            <input
              className="form-control"
              value={linkedRef}
              onChange={(event) => onSetLinkedRef(event.target.value)}
              placeholder={m.calendar_linked_ref_placeholder()}
            />
          </div>
          <div className="d-flex gap-2 flex-column flex-sm-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={isAdding}
              onClick={() => void onAddPlanned()}
            >
              {isAdding
                ? editingPlannedItemId !== null
                  ? m.action_saving()
                  : m.action_adding()
                : editingPlannedItemId !== null
                  ? m.calendar_save_item()
                  : m.calendar_add_item()}
            </button>
            {editingPlannedItemId !== null ? (
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={isAdding}
                onClick={onCancelEdit}
              >
                {m.calendar_cancel_edit()}
              </button>
            ) : null}
          </div>
        </div>
        {addError && editingPlannedItemId !== null ? (
          <div className="card-footer text-danger py-2 small">{addError}</div>
        ) : null}
      </div>

      <div className="card mb-3">
        <div className="card-header fw-semibold py-2">{m.calendar_planned_items_header({ date: formatDate(selectedDate) })}</div>
        <ul className="list-group list-group-flush">
          {plannedItems.length === 0 ? (
            <li className="list-group-item py-2 text-muted">{m.calendar_no_planned_items()}</li>
          ) : (
            plannedItems.map((item) => (
              <li
                key={item.id}
                className="list-group-item py-2"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("plannedItemId", String(item.id));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onTouchStart={(e) => {
                  if (!onDropReschedule) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clone = e.currentTarget.cloneNode(true) as HTMLElement;
                  clone.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;opacity:0.75;pointer-events:none;z-index:9999;background:var(--bs-body-bg);border:1px solid var(--bs-border-color);border-radius:4px;`;
                  document.body.appendChild(clone);
                  touchCloneRef.current = clone;
                }}
                onTouchMove={(e) => {
                  if (!touchCloneRef.current) return;
                  e.preventDefault();
                  const touch = e.touches[0];
                  if (!touch) return;
                  touchCloneRef.current.style.top = `${touch.clientY - 20}px`;
                  touchCloneRef.current.style.left = `${touch.clientX - 20}px`;
                }}
                onTouchEnd={(e) => {
                  touchCloneRef.current?.remove();
                  touchCloneRef.current = null;
                  if (!onDropReschedule) return;
                  const touch = e.changedTouches[0];
                  if (!touch) return;
                  const el = document.elementFromPoint(touch.clientX, touch.clientY);
                  const cell = el?.closest("[data-date]") as HTMLElement | null;
                  const date = cell?.dataset.date;
                  if (date) onDropReschedule(item.id, date);
                }}
              >
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <div className="fw-semibold">{item.title}</div>
                    <small className="text-muted d-block">{formatPlannedMeta(item)}</small>
                    {item.notes ? <small className="d-block mt-1">{item.notes}</small> : null}
                    {item.linked_ref ? (
                      <small className="d-block text-muted">{m.calendar_ref_label({ ref: item.linked_ref })}</small>
                    ) : null}
                  </div>
                  <div className="d-grid gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${item.is_done ? "btn-outline-success" : "btn-success"}`}
                      disabled={isAdding}
                      onClick={() => void onToggleDone(item)}
                    >
                      {item.is_done ? m.action_undo() : m.action_done()}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      disabled={isAdding}
                      onClick={() => onStartEdit(item)}
                    >
                      {m.action_edit()}
                    </button>
                    {confirmDeleteId === item.id ? (
                      <div className="d-flex gap-1">
                        {item.rrule || item.recurrence_series_id ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={isAdding}
                              onClick={() => void onRemovePlannedItem(item.id, "this")}
                            >
                              This
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              disabled={isAdding}
                              onClick={() => void onRemovePlannedItem(item.id, "future")}
                            >
                              This + future
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={isAdding}
                            onClick={() => void onRemovePlannedItem(item.id)}
                          >
                            {m.action_confirm()}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={isAdding}
                          onClick={() => onSetConfirmDeleteId(null)}
                        >
                          {m.action_cancel()}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        disabled={isAdding}
                        onClick={() => onSetConfirmDeleteId(item.id)}
                      >
                        {m.action_delete()}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="card">
        <div className="card-header fw-semibold py-2">{m.calendar_backup_header()}</div>
        <div className="card-body">
          <div className="d-flex flex-column flex-sm-row gap-2">
            <button
              type="button"
              className="btn btn-outline-primary"
              disabled={isExporting || isImporting}
              onClick={() => void onExportBackup()}
            >
              {isExporting ? m.calendar_exporting() : m.calendar_export_backup()}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={isExporting || isImporting}
              onClick={() => fileInputRef.current?.click()}
            >
              {isImporting ? m.calendar_importing() : m.calendar_import_backup()}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="d-none"
              onChange={(event) => void onImportFile(event)}
            />
          </div>
          {backupStatus ? <small className="text-muted d-block mt-2">{backupStatus}</small> : null}
        </div>
      </div>
    </>
  );
}
