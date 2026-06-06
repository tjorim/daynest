import { useEffect, useMemo, useState } from "react";
import * as m from "@/paraglide/messages";
import { isRetryableApiError } from "@/lib/api/today";
import { dayjs, formatDate, toIsoDate } from "@/lib/dateUtils";
import type { RecurringGroceryInput, RecurringGrocerySeries } from "@/lib/api/recurringGroceries";
import { useShoppingListsQuery } from "@/features/shopping/useShoppingLists";
import {
  useRecurringGroceryActions,
  useRecurringGroceriesQuery,
} from "@/features/shopping/useRecurringGroceries";
import {
  buildRRule,
  parseRRule,
  selectedDateWeekdayCode,
  type RepeatPreset,
} from "@/features/shopping/rruleControls";

const WEEKDAY_REPEAT_OPTIONS = [
  { code: "MO", label: m.calendar_weekday_mon },
  { code: "TU", label: m.calendar_weekday_tue },
  { code: "WE", label: m.calendar_weekday_wed },
  { code: "TH", label: m.calendar_weekday_thu },
  { code: "FR", label: m.calendar_weekday_fri },
  { code: "SA", label: m.calendar_weekday_sat },
  { code: "SU", label: m.calendar_weekday_sun },
] as const;

function formatRRule(rrule: string): string {
  if (!rrule) return m.calendar_repeats();
  const parsed = parseRRule(rrule, "MO");
  if (parsed.preset === "daily") return m.calendar_repeat_daily();
  if (parsed.preset === "monthly") return m.calendar_repeat_monthly();
  if (parsed.preset === "custom") {
    return `${m.calendar_repeat_every()} ${parsed.customInterval} ${m.calendar_repeat_days()}`;
  }
  const weekdayLabels = parsed.weekdays.map((code) => {
    const option = WEEKDAY_REPEAT_OPTIONS.find((opt) => opt.code === code);
    return option ? option.label() : code;
  });
  return `${m.calendar_repeat_weekly()} (${weekdayLabels.join(", ")})`;
}

function splitTags(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function RecurringGroceriesPage() {
  const recurringQuery = useRecurringGroceriesQuery();
  const listsQuery = useShoppingListsQuery("active");
  const actions = useRecurringGroceryActions(async () => {
    await Promise.all([recurringQuery.refetch(), listsQuery.refetch()]);
  });
  const [editingSeries, setEditingSeries] = useState<RecurringGrocerySeries | null>(null);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(toIsoDate(dayjs()));
  const [notes, setNotes] = useState("");
  const [autoAddToListId, setAutoAddToListId] = useState("");
  const [tags, setTags] = useState("");
  const [repeatPreset, setRepeatPreset] = useState<RepeatPreset>("weekly");
  const [repeatWeekdays, setRepeatWeekdays] = useState<string[]>([selectedDateWeekdayCode(startDate)]);
  const [customInterval, setCustomInterval] = useState(2);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const lists = listsQuery.data ?? [];
  const listNameById = useMemo(
    () => new Map(lists.map((list) => [list.id, list.name])),
    [lists],
  );
  const queryError = recurringQuery.error ?? listsQuery.error;
  const error = queryError instanceof Error ? queryError.message : null;
  const canRetry = queryError ? isRetryableApiError(queryError) : false;
  const loading = recurringQuery.isPending || listsQuery.isPending;

  useEffect(() => {
    if (!editingSeries) {
      setRepeatWeekdays([selectedDateWeekdayCode(startDate)]);
    }
  }, [editingSeries, startDate]);

  const resetForm = () => {
    const today = toIsoDate(dayjs());
    setEditingSeries(null);
    setTitle("");
    setStartDate(today);
    setNotes("");
    setAutoAddToListId("");
    setTags("");
    setRepeatPreset("weekly");
    setRepeatWeekdays([selectedDateWeekdayCode(today)]);
    setCustomInterval(2);
    actions.clearActionError();
  };

  const startEditing = (series: RecurringGrocerySeries) => {
    const parsed = parseRRule(series.rrule, selectedDateWeekdayCode(series.startDate));
    setEditingSeries(series);
    setTitle(series.title);
    setStartDate(series.startDate);
    setNotes(series.notes ?? "");
    setAutoAddToListId(series.autoAddToListId ? String(series.autoAddToListId) : "");
    setTags(series.tags.join(", "));
    setRepeatPreset(parsed.preset);
    setRepeatWeekdays(parsed.weekdays);
    setCustomInterval(parsed.customInterval);
    setSuccessMessage(null);
    actions.clearActionError();
  };

  const buildPayload = (): RecurringGroceryInput => {
    const rrule = buildRRule(repeatPreset, repeatWeekdays, customInterval, startDate);
    return {
      title: title.trim(),
      planned_for: startDate,
      notes: notes.trim() || null,
      rrule,
      recurrence_hint: formatRRule(rrule),
      auto_add_to_list_id: autoAddToListId ? Number(autoAddToListId) : null,
      tags: splitTags(tags),
    };
  };

  const submit = async () => {
    if (!title.trim() || !startDate) return;
    setSuccessMessage(null);
    try {
      const payload = buildPayload();
      if (editingSeries) {
        await actions.updateSeries(editingSeries, payload);
        setSuccessMessage(m.recurring_groceries_updated());
      } else {
        await actions.createSeries(payload);
        setSuccessMessage(m.recurring_groceries_created());
      }
      resetForm();
    } catch {
      // Displayed through actions.actionError.
    }
  };

  const deleteSeries = async (series: RecurringGrocerySeries) => {
    setSuccessMessage(null);
    try {
      await actions.deleteSeries(series);
      setSuccessMessage(m.recurring_groceries_deleted());
      if (editingSeries?.key === series.key) resetForm();
    } catch {
      // Displayed through actions.actionError.
    }
  };

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">{m.recurring_groceries_title()}</h2>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={loading}
          onClick={() => void Promise.all([recurringQuery.refetch(), listsQuery.refetch()])}
        >
          {m.action_refresh()}
        </button>
      </div>
      <p className="text-muted mb-3">{m.recurring_groceries_subtitle()}</p>

      {loading ? <div className="alert alert-info py-2">{m.recurring_groceries_loading()}</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void Promise.all([recurringQuery.refetch(), listsQuery.refetch()])}
            >
              {m.action_retry()}
            </button>
          ) : null}
        </div>
      ) : null}
      {actions.actionError ? <div className="alert alert-danger py-2">{actions.actionError}</div> : null}
      {successMessage ? <div className="alert alert-success py-2">{successMessage}</div> : null}

      <div className="card mb-3">
        <div className="card-body">
          <h3 className="h6 mb-3">
            {editingSeries ? m.recurring_groceries_edit() : m.recurring_groceries_create()}
          </h3>
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="form-label" htmlFor="recurring-grocery-title">
                {m.recurring_groceries_item_name()}
              </label>
              <input
                id="recurring-grocery-title"
                className="form-control"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={m.recurring_groceries_item_placeholder()}
              />
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label" htmlFor="recurring-grocery-start">
                {m.recurring_groceries_start_date()}
              </label>
              <input
                id="recurring-grocery-start"
                type="date"
                className="form-control"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="recurring-grocery-list">
                {m.recurring_groceries_auto_add()}
              </label>
              <select
                id="recurring-grocery-list"
                className="form-select"
                value={autoAddToListId}
                onChange={(event) => setAutoAddToListId(event.target.value)}
              >
                <option value="">{m.recurring_groceries_no_auto_add()}</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="recurring-grocery-tags">
                {m.recurring_groceries_tags()}
              </label>
              <input
                id="recurring-grocery-tags"
                className="form-control"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder={m.recurring_groceries_tags_placeholder()}
              />
            </div>
            <div className="col-12">
              <textarea
                className="form-control"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={m.today_notes_optional()}
              />
            </div>
            <div className="col-12">
              <div className="d-grid gap-2 border rounded p-2">
                <select
                  className="form-select"
                  value={repeatPreset}
                  onChange={(event) => setRepeatPreset(event.target.value as RepeatPreset)}
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
                              setRepeatWeekdays([...repeatWeekdays, weekday.code]);
                              return;
                            }
                            setRepeatWeekdays(repeatWeekdays.filter((value) => value !== weekday.code));
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
                      onChange={(event) => {
                        const val = parseInt(event.target.value, 10);
                        setCustomInterval(isNaN(val) ? 2 : Math.max(2, val));
                      }}
                    />
                    <span className="input-group-text">{m.calendar_repeat_days()}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="col-12 d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={actions.isSubmitting || !title.trim() || !startDate}
                onClick={() => void submit()}
              >
                {actions.isSubmitting ? m.action_saving() : editingSeries ? m.action_save() : m.action_add()}
              </button>
              {editingSeries ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={actions.isSubmitting}
                  onClick={resetForm}
                >
                  {m.action_cancel()}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {recurringQuery.data?.length === 0 ? (
        <div className="alert alert-secondary py-2">{m.recurring_groceries_no_items()}</div>
      ) : null}
      <div className="row g-3">
        {(recurringQuery.data ?? []).map((series) => (
          <div className="col-12 col-md-6 col-xl-4" key={series.key}>
            <div className="card h-100">
              <div className="card-body d-flex flex-column gap-2">
                <div>
                  <h3 className="h5 mb-1">{series.title}</h3>
                  <div className="text-muted small">
                    {m.recurring_groceries_cadence({ cadence: series.recurrenceHint ?? formatRRule(series.rrule) })}
                  </div>
                  <div className="text-muted small">{m.shopping_planned_for_date({ date: formatDate(series.startDate) })}</div>
                  {series.autoAddToListId ? (
                    <div className="text-muted small">
                      {m.recurring_groceries_auto_add_to({
                        list: listNameById.get(series.autoAddToListId) ?? `#${series.autoAddToListId}`,
                      })}
                    </div>
                  ) : null}
                  {series.notes ? <p className="mb-0 small">{series.notes}</p> : null}
                  {series.tags.length ? (
                    <div className="d-flex flex-wrap gap-1 mt-2">
                      {series.tags.map((tag) => (
                        <span className="badge text-bg-light" key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="d-flex flex-wrap gap-2 mt-auto">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    disabled={actions.isSubmitting}
                    onClick={() => startEditing(series)}
                  >
                    {m.action_edit()}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    disabled={actions.isSubmitting}
                    onClick={() => void deleteSeries(series)}
                  >
                    {m.action_delete()}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
