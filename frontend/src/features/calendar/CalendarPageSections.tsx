import type { ChangeEvent, RefObject } from "react";
import * as m from "@/paraglide/messages";
import { formatDate } from "@/lib/dateUtils";
import {
  type PlannedItemEditScope,
  type PlannedItemModuleKey,
  type PlannedTodayItem,
} from "@/lib/api/today";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input, InputGroup, InputGroupText, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ListGroup, ListGroupItem } from "@/components/ui/list-group";

function formatPlannedMeta(item: PlannedTodayItem): string {
  const timeAndDuration = [
    item.time_of_day ? item.time_of_day.slice(0, 5) : null,
    item.duration_minutes ? m.calendar_duration_minutes({ minutes: item.duration_minutes }) : null,
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
    item.linked_source ? m.calendar_source_label({ source: item.linked_source }) : null,
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
      <Card className="tw:mb-4">
        <CardHeader className="tw:font-semibold tw:py-2">
          {m.calendar_quick_add_header()}
        </CardHeader>
        <CardContent className="tw:grid tw:gap-4">
          <div className="tw:grid tw:gap-2">
            <Input
              value={title}
              onChange={(event) => onSetTitle(event.target.value)}
              placeholder={m.calendar_plan_title_placeholder()}
              aria-label={m.calendar_plan_title_placeholder()}
            />
            <Label className="tw:mt-2 tw:mb-1" htmlFor="planned-time-of-day">
              {m.calendar_time_of_day_label()}
            </Label>
            <Input
              id="planned-time-of-day"
              type="time"
              value={timeOfDay}
              onChange={(event) => onSetTimeOfDay(event.target.value)}
            />
            <Label className="tw:mt-2 tw:mb-1" htmlFor="planned-duration-minutes">
              {m.calendar_duration_label()}
            </Label>
            <Input
              id="planned-duration-minutes"
              type="number"
              min={1}
              value={durationMinutes ?? ""}
              onChange={(event) =>
                onSetDurationMinutes(event.target.value === "" ? null : Number(event.target.value))
              }
              placeholder={m.calendar_duration_placeholder()}
            />
            <Textarea
              rows={3}
              value={notes}
              onChange={(event) => onSetNotes(event.target.value)}
              placeholder={m.calendar_notes_placeholder()}
              aria-label={m.calendar_notes_placeholder()}
            />
            <Select
              value={moduleKey}
              onChange={(event) => onSetModuleKey(event.target.value as PlannedItemModuleKey | "")}
              aria-label={m.calendar_optional_module_label()}
            >
              <option value="">{m.calendar_module_general()}</option>
              <option value="shopping_list">{m.calendar_module_shopping()}</option>
              <option value="meal_planning">{m.calendar_module_meal()}</option>
              <option value="recurring_grocery">{m.calendar_module_grocery()}</option>
              <option value="shared_calendar">{m.calendar_module_shared()}</option>
            </Select>
            <div className="tw:flex tw:items-start tw:gap-2 tw:min-h-6 tw:mb-0.5">
              <Checkbox
                id="planned-repeat-toggle"
                checked={isRepeating}
                onChange={(event) => onSetIsRepeating(event.target.checked)}
              />
              <label htmlFor="planned-repeat-toggle">{m.calendar_repeat_label()}</label>
            </div>
            {isRepeating ? (
              <div className="tw:grid tw:gap-2 tw:border tw:border-border tw:rounded-md tw:p-2">
                <Select
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
                </Select>
                {repeatPreset === "weekly" ? (
                  <div className="tw:flex tw:flex-wrap tw:gap-2">
                    {WEEKDAY_REPEAT_OPTIONS.map((weekday) => (
                      <label
                        key={weekday.code}
                        className="tw:flex tw:items-start tw:gap-2 tw:min-h-6 tw:me-4"
                      >
                        <Checkbox
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
                      onChange={(event) =>
                        onSetCustomInterval(Math.max(2, Number(event.target.value || 2)))
                      }
                    />
                    <InputGroupText>{m.calendar_repeat_days()}</InputGroupText>
                  </InputGroup>
                ) : null}
              </div>
            ) : (
              <Input
                value={recurrenceHint}
                onChange={(event) => onSetRecurrenceHint(event.target.value)}
                placeholder={m.calendar_recurrence_placeholder()}
                aria-label={m.calendar_recurrence_placeholder()}
              />
            )}
            <Input
              value={linkedSource}
              onChange={(event) => onSetLinkedSource(event.target.value)}
              placeholder={m.calendar_linked_source_placeholder()}
              aria-label={m.calendar_linked_source_placeholder()}
            />
            <Input
              value={linkedRef}
              onChange={(event) => onSetLinkedRef(event.target.value)}
              placeholder={m.calendar_linked_ref_placeholder()}
              aria-label={m.calendar_linked_ref_placeholder()}
            />
            {editingPlannedItemId !== null &&
            (() => {
              const editingItem = plannedItems.find((item) => item.id === editingPlannedItemId);
              return Boolean(editingItem?.rrule || editingItem?.recurrence_series_id);
            })() ? (
              <Select
                value={editScope}
                onChange={(event) => onSetEditScope(event.target.value as PlannedItemEditScope)}
                aria-label={m.calendar_planned_edit_scope_label()}
              >
                <option value="this">{m.calendar_planned_edit_scope_this()}</option>
                <option value="future">{m.calendar_planned_edit_scope_future()}</option>
                <option value="all">{m.calendar_planned_edit_scope_all()}</option>
              </Select>
            ) : null}
          </div>
          <div className="tw:flex tw:gap-2 tw:flex-col tw:sm:flex-row">
            <Button disabled={isAdding} onClick={() => void onAddPlanned()}>
              {isAdding
                ? editingPlannedItemId !== null
                  ? m.action_saving()
                  : m.action_adding()
                : editingPlannedItemId !== null
                  ? m.calendar_save_item()
                  : m.calendar_add_item()}
            </Button>
            {editingPlannedItemId !== null ? (
              <Button variant="outline-secondary" disabled={isAdding} onClick={onCancelEdit}>
                {m.calendar_cancel_edit()}
              </Button>
            ) : null}
          </div>
        </CardContent>
        {addError && editingPlannedItemId !== null ? (
          <CardFooter className="tw:text-danger tw:py-2 tw:text-small">{addError}</CardFooter>
        ) : null}
      </Card>

      <Card className="tw:mb-4">
        <CardHeader className="tw:font-semibold tw:py-2">
          {m.calendar_planned_items_header({ date: formatDate(selectedDate) })}
        </CardHeader>
        <ListGroup
          flush
          render={<ul />}
          aria-label={m.calendar_planned_items_header({ date: formatDate(selectedDate) })}
        >
          {plannedItems.length === 0 ? (
            <ListGroupItem render={<li />} className="tw:py-2 tw:text-muted-foreground">
              {m.calendar_no_planned_items()}
            </ListGroupItem>
          ) : (
            plannedItems.map((item) => (
              <ListGroupItem render={<li />} className="tw:py-2" key={item.id}>
                <div className="tw:flex tw:justify-between tw:items-start tw:gap-4">
                  <div>
                    <div className="tw:font-semibold">
                      {item.rrule || item.recurrence_series_id ? "🔁 " : ""}
                      {item.title}
                    </div>
                    <small className="tw:text-muted-foreground tw:block">
                      {formatPlannedMeta(item)}
                    </small>
                    {item.notes ? <small className="tw:block tw:mt-1">{item.notes}</small> : null}
                    {item.linked_ref ? (
                      <small className="tw:block tw:text-muted-foreground">
                        {m.calendar_ref_label({ ref: item.linked_ref })}
                      </small>
                    ) : null}
                  </div>
                  <div className="tw:grid tw:gap-2">
                    <Button
                      variant={item.is_done ? "outline-success" : "success"}
                      size="sm"
                      disabled={isAdding}
                      onClick={() => void onToggleDone(item)}
                    >
                      {item.is_done ? m.action_undo() : m.action_done()}
                    </Button>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      disabled={isAdding}
                      onClick={() => onStartEdit(item)}
                    >
                      {m.action_edit()}
                    </Button>
                    {confirmDeleteId === item.id ? (
                      <div className="tw:flex tw:gap-1">
                        {item.rrule || item.recurrence_series_id ? (
                          <>
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={isAdding}
                              onClick={() => void onRemovePlannedItem(item.id, "this")}
                            >
                              {m.calendar_delete_this()}
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              disabled={isAdding}
                              onClick={() => void onRemovePlannedItem(item.id, "future")}
                            >
                              {m.calendar_delete_this_and_future()}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={isAdding}
                            onClick={() => void onRemovePlannedItem(item.id)}
                          >
                            {m.action_confirm()}
                          </Button>
                        )}
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          disabled={isAdding}
                          onClick={() => onSetConfirmDeleteId(null)}
                        >
                          {m.action_cancel()}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline-danger"
                        size="sm"
                        disabled={isAdding}
                        onClick={() => onSetConfirmDeleteId(item.id)}
                      >
                        {m.action_delete()}
                      </Button>
                    )}
                  </div>
                </div>
              </ListGroupItem>
            ))
          )}
        </ListGroup>
      </Card>

      <Card>
        <CardHeader className="tw:font-semibold tw:py-2">{m.calendar_backup_header()}</CardHeader>
        <CardContent>
          <div className="tw:flex tw:flex-col tw:sm:flex-row tw:gap-2">
            <Button
              variant="outline-primary"
              disabled={isExporting || isImporting}
              onClick={() => void onExportBackup()}
            >
              {isExporting ? m.calendar_exporting() : m.calendar_export_backup()}
            </Button>
            <Button
              variant="outline-secondary"
              disabled={isExporting || isImporting}
              onClick={() => fileInputRef.current?.click()}
            >
              {isImporting ? m.calendar_importing() : m.calendar_import_backup()}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="tw:hidden"
              onChange={(event) => void onImportFile(event)}
            />
          </div>
          {backupStatus ? (
            <small className="tw:text-muted-foreground tw:block tw:mt-2">{backupStatus}</small>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
