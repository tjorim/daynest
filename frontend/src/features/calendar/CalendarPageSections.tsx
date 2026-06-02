import type { ChangeEvent, RefObject } from "react";
import * as m from "@/paraglide/messages";
import { formatDate } from "@/lib/dateUtils";
import {
  type PlannedItemEditScope,
  type PlannedItemModuleKey,
  type PlannedTodayItem,
} from "@/lib/api/today";

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
    item.rrule || item.recurrence_series_id
      ? item.recurrence_hint
        ? m.calendar_repeat_hint({ hint: item.recurrence_hint })
        : m.calendar_repeats()
      : null,
    item.linked_source ? `Source: ${item.linked_source}` : null,
  ];

  return values.filter(Boolean).join(" • ");
}

const WEEKDAY_REPEAT_OPTIONS = [
  { code: "MO", label: m.calendar_weekday_mon },
  { code: "TU", label: m.calendar_weekday_tue },
  { code: "WE", label: m.calendar_weekday_wed },
  { code: "TH", label: m.calendar_weekday_thu },
  { code: "FR", label: m.calendar_weekday_fri },
  { code: "SA", label: m.calendar_weekday_sat },
  { code: "SU", label: m.calendar_weekday_sun },
] as const;

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
  editScope,
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
  onSetEditScope,
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
  editScope: PlannedItemEditScope;
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
  onSetEditScope: (value: PlannedItemEditScope) => void;
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
}) {
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
                {m.calendar_repeat_label()}
              </label>
            </div>
            {isRepeating ? (
              <div className="d-grid gap-2 border rounded p-2">
                <select
                  className="form-select"
                  value={repeatPreset}
                  onChange={(event) =>
                    onSetRepeatPreset(
                      event.target.value as "daily" | "weekly" | "monthly" | "custom",
                    )
                  }
                  aria-label={m.calendar_repeat_schedule_aria()}
                >
                  <option value="daily">{m.calendar_repeat_daily()}</option>
                  <option value="weekly">{m.calendar_repeat_weekly()}</option>
                  <option value="monthly">{m.calendar_repeat_monthly()}</option>
                  <option value="custom">{m.calendar_repeat_custom()}</option>
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
                    <span className="input-group-text">{m.calendar_repeat_every()}</span>
                    <input
                      type="number"
                      className="form-control"
                      min={2}
                      value={customInterval}
                      onChange={(event) =>
                        onSetCustomInterval(Math.max(2, Number(event.target.value || 2)))
                      }
                    />
                    <span className="input-group-text">{m.calendar_repeat_days()}</span>
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
            {editingPlannedItemId !== null &&
            (() => {
              const editingItem = plannedItems.find((item) => item.id === editingPlannedItemId);
              return Boolean(editingItem?.rrule || editingItem?.recurrence_series_id);
            })() ? (
              <select
                className="form-select"
                value={editScope}
                onChange={(event) => onSetEditScope(event.target.value as PlannedItemEditScope)}
                aria-label={m.calendar_planned_edit_scope_label()}
              >
                <option value="this">{m.calendar_planned_edit_scope_this()}</option>
                <option value="future">{m.calendar_planned_edit_scope_future()}</option>
                <option value="all">{m.calendar_planned_edit_scope_all()}</option>
              </select>
            ) : null}
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
        <div className="card-header fw-semibold py-2">
          {m.calendar_planned_items_header({ date: formatDate(selectedDate) })}
        </div>
        <ul className="list-group list-group-flush">
          {plannedItems.length === 0 ? (
            <li className="list-group-item py-2 text-muted">{m.calendar_no_planned_items()}</li>
          ) : (
            plannedItems.map((item) => (
              <li key={item.id} className="list-group-item py-2">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <div className="fw-semibold">
                      {item.rrule || item.recurrence_series_id ? "🔁 " : ""}
                      {item.title}
                    </div>
                    <small className="text-muted d-block">{formatPlannedMeta(item)}</small>
                    {item.notes ? <small className="d-block mt-1">{item.notes}</small> : null}
                    {item.linked_ref ? (
                      <small className="d-block text-muted">
                        {m.calendar_ref_label({ ref: item.linked_ref })}
                      </small>
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
                              {m.calendar_delete_this()}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              disabled={isAdding}
                              onClick={() => void onRemovePlannedItem(item.id, "future")}
                            >
                              {m.calendar_delete_this_and_future()}
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
