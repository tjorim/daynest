import { useEffect, useMemo, useState } from "react";
import * as m from "@/paraglide/messages";
import { isRetryableApiError } from "@/lib/api/http";
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
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/field";
import { Input, InputGroup, InputGroupText, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

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
  const [repeatWeekdays, setRepeatWeekdays] = useState<string[]>([
    selectedDateWeekdayCode(startDate),
  ]);
  const [customInterval, setCustomInterval] = useState(2);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const lists = listsQuery.data ?? [];
  const listNameById = useMemo(() => new Map(lists.map((list) => [list.id, list.name])), [lists]);
  const queryError = recurringQuery.error ?? listsQuery.error;
  const error = queryError
    ? apiErrorMessage(queryError, m.recurring_groceries_load_failed())
    : null;
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
        <h2 className="text-h4 font-medium mb-0">{m.recurring_groceries_title()}</h2>
        <Button
          variant="outline-primary"
          size="sm"
          disabled={loading}
          onClick={() => void Promise.all([recurringQuery.refetch(), listsQuery.refetch()])}
        >
          {m.action_refresh()}
        </Button>
      </div>
      <p className="text-muted-foreground mb-4">{m.recurring_groceries_subtitle()}</p>

      {loading ? (
        <Alert variant="info" className="py-2">
          {m.recurring_groceries_loading()}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" className="py-2 flex justify-between items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => void Promise.all([recurringQuery.refetch(), listsQuery.refetch()])}
            >
              {m.action_retry()}
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {actions.actionError ? (
        <Alert variant="danger" className="py-2">
          {actions.actionError}
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert variant="success" className="py-2">
          {successMessage}
        </Alert>
      ) : null}

      <Card className="mb-4">
        <CardContent>
          <h3 className="text-h6 font-medium mb-4">
            {editingSeries ? m.recurring_groceries_edit() : m.recurring_groceries_create()}
          </h3>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12 md:col-span-4">
              <Label htmlFor="recurring-grocery-title">{m.recurring_groceries_item_name()}</Label>
              <Input
                id="recurring-grocery-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={m.recurring_groceries_item_placeholder()}
              />
            </div>
            <div className="col-span-12 md:col-span-2">
              <Label htmlFor="recurring-grocery-start">{m.recurring_groceries_start_date()}</Label>
              <Input
                id="recurring-grocery-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <Label htmlFor="recurring-grocery-list">{m.recurring_groceries_auto_add()}</Label>
              <Select
                id="recurring-grocery-list"
                value={autoAddToListId}
                onChange={(event) => setAutoAddToListId(event.target.value)}
              >
                <option value="">{m.recurring_groceries_no_auto_add()}</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="col-span-12 md:col-span-3">
              <Label htmlFor="recurring-grocery-tags">{m.recurring_groceries_tags()}</Label>
              <Input
                id="recurring-grocery-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder={m.recurring_groceries_tags_placeholder()}
              />
            </div>
            <div className="col-span-12">
              <Textarea
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={m.today_notes_optional()}
              />
            </div>
            <div className="col-span-12">
              <div className="grid gap-2 border border-border rounded-md p-2">
                <Select
                  value={repeatPreset}
                  onChange={(event) => setRepeatPreset(event.target.value as RepeatPreset)}
                  aria-label={m.calendar_repeat_schedule_aria()}
                >
                  <option value="daily">{m.calendar_repeat_daily()}</option>
                  <option value="weekly">{m.calendar_repeat_weekly()}</option>
                  <option value="monthly">{m.calendar_repeat_monthly()}</option>
                  <option value="custom">{m.calendar_repeat_custom()}</option>
                </Select>
                {repeatPreset === "weekly" ? (
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_REPEAT_OPTIONS.map((weekday) => (
                      <label key={weekday.code} className="check-row me-4 mb-0">
                        <Checkbox
                          checked={repeatWeekdays.includes(weekday.code)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setRepeatWeekdays([...repeatWeekdays, weekday.code]);
                              return;
                            }
                            setRepeatWeekdays(
                              repeatWeekdays.filter((value) => value !== weekday.code),
                            );
                          }}
                        />
                        <span>{weekday.label()}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
                {repeatPreset === "custom" ? (
                  <InputGroup>
                    <InputGroupText>{m.calendar_repeat_every()}</InputGroupText>
                    <Input
                      type="number"
                      min={2}
                      value={customInterval}
                      onChange={(event) => {
                        const val = parseInt(event.target.value, 10);
                        setCustomInterval(isNaN(val) ? 2 : Math.max(2, val));
                      }}
                    />
                    <InputGroupText>{m.calendar_repeat_days()}</InputGroupText>
                  </InputGroup>
                ) : null}
              </div>
            </div>
            <div className="col-span-12 flex flex-wrap gap-2">
              <Button
                disabled={actions.isSubmitting || !title.trim() || !startDate}
                onClick={() => void submit()}
              >
                {actions.isSubmitting
                  ? m.action_saving()
                  : editingSeries
                    ? m.action_save()
                    : m.action_add()}
              </Button>
              {editingSeries ? (
                <Button
                  variant="outline-secondary"
                  disabled={actions.isSubmitting}
                  onClick={resetForm}
                >
                  {m.action_cancel()}
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {recurringQuery.data?.length === 0 ? (
        <Alert variant="secondary" className="py-2">
          {m.recurring_groceries_no_items()}
        </Alert>
      ) : null}
      <div className="grid grid-cols-12 gap-4">
        {(recurringQuery.data ?? []).map((series) => (
          <div className="col-span-12 md:col-span-6 xl:col-span-4" key={series.key}>
            <Card className="h-full">
              <CardContent className="flex flex-col gap-2">
                <div>
                  <h3 className="text-h5 font-medium mb-1">{series.title}</h3>
                  <div className="text-muted-foreground text-small">
                    {m.recurring_groceries_cadence({
                      cadence: series.recurrenceHint ?? formatRRule(series.rrule),
                    })}
                  </div>
                  <div className="text-muted-foreground text-small">
                    {m.shopping_planned_for_date({ date: formatDate(series.startDate) })}
                  </div>
                  {series.autoAddToListId ? (
                    <div className="text-muted-foreground text-small">
                      {m.recurring_groceries_auto_add_to({
                        list:
                          listNameById.get(series.autoAddToListId) ?? `#${series.autoAddToListId}`,
                      })}
                    </div>
                  ) : null}
                  {series.notes ? <p className="mb-0 text-small">{series.notes}</p> : null}
                  {series.tags.length ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {series.tags.map((tag) => (
                        <Badge variant="light" key={tag}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 mt-auto">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    disabled={actions.isSubmitting}
                    onClick={() => startEditing(series)}
                  >
                    {m.action_edit()}
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    disabled={actions.isSubmitting}
                    onClick={() => void deleteSeries(series)}
                  >
                    {m.action_delete()}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </section>
  );
}
