import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import {
  completeChore,
  completeRoutineTask,
  type CalendarDayPayload,
  type CalendarMonthDaySummary,
  fetchCalendarDay,
  fetchCalendarMonth,
  isRetryableApiError,
  listPlannedItems,
  rescheduleChore,
  skipRoutineTask,
  skipChore,
  startRoutineTask,
} from "@/lib/api/today";
import { dayjs, formatMonthYear, toIsoDate } from "@/lib/dateUtils";
import {
  CalendarMonthGrid,
  DayDetailsPanel,
  MonthNavigationControls,
  PlannedItemsSidebar,
} from "@/features/calendar/CalendarPageSections";
import { useCalendarPlannedItems } from "@/features/calendar/useCalendarPlannedItems";

function parseMonth(value?: string) {
  if (!value) return null;
  const parsed = dayjs(`${value}-01`);
  if (!parsed.isValid() || parsed.format("YYYY-MM") !== value) {
    return null;
  }
  return parsed;
}

function parseDate(value?: string) {
  if (!value) return null;
  const parsed = dayjs(value);
  if (!parsed.isValid() || parsed.format("YYYY-MM-DD") !== value) {
    return null;
  }
  return parsed;
}

export function CalendarPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/protected/calendar" });
  const [currentMonth, setCurrentMonth] = useState(() => parseMonth(search.month) ?? dayjs());
  const [monthItems, setMonthItems] = useState<CalendarMonthDaySummary[]>([]);
  const [selectedDate, setSelectedDate] = useState(() =>
    toIsoDate(parseDate(search.date) ?? dayjs()),
  );
  const [dayPayload, setDayPayload] = useState<CalendarDayPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [dayActionStatus, setDayActionStatus] = useState<string | null>(null);
  const [isRunningDayAction, setIsRunningDayAction] = useState(false);

  const monthKey = useMemo(
    () => ({ year: currentMonth.year(), month: currentMonth.month() + 1 }),
    [currentMonth],
  );
  const monthStart = currentMonth.startOf("month");

  useEffect(() => {
    const searchMonth = parseMonth(search.month);
    if (searchMonth && !searchMonth.isSame(currentMonth, "month")) {
      setCurrentMonth(searchMonth);
    }
  }, [currentMonth, search.month]);

  useEffect(() => {
    const searchDate = parseDate(search.date);
    if (searchDate) {
      const searchDateString = toIsoDate(searchDate);
      if (searchDateString !== selectedDate) {
        setSelectedDate(searchDateString);
      }
    }
  }, [search.date, selectedDate]);

  const updateSearch = (nextMonth: dayjs.Dayjs, nextDate: string) => {
    void navigate({
      search: {
        month: nextMonth.format("YYYY-MM"),
        date: nextDate,
      },
      replace: true,
    });
  };

  const loadCalendar = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setCanRetry(false);
    try {
      const [month, day, selectedPlanned] = await Promise.all([
        fetchCalendarMonth(monthKey.year, monthKey.month, signal),
        fetchCalendarDay(selectedDate, signal),
        listPlannedItems(selectedDate, selectedDate, signal),
      ]);
      setMonthItems(month.days);
      setDayPayload(day);
      planned.setPlannedItems(selectedPlanned);
    } catch (err) {
      if (!signal?.aborted) {
        setCanRetry(isRetryableApiError(err));
        setError(err instanceof Error ? err.message : "Unable to load calendar view.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const planned = useCalendarPlannedItems({
    selectedDate,
    monthStart,
    monthKey,
    loadCalendar: () => loadCalendar(),
  });

  useEffect(() => {
    const controller = new AbortController();
    void loadCalendar(controller.signal);
    return () => controller.abort();
  }, [monthKey.month, monthKey.year, selectedDate]);

  const runDayItemAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setDayActionStatus(null);
    planned.clearAddError();
    setIsRunningDayAction(true);
    try {
      await action();
      await loadCalendar();
      setDayActionStatus(successMessage);
    } catch (err) {
      planned.setAddError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setIsRunningDayAction(false);
    }
  };

  return (
    <section>
      <MonthNavigationControls
        onRefresh={() => void loadCalendar()}
        onPrevMonth={() => {
          const nextMonth = currentMonth.subtract(1, "month");
          setCurrentMonth(nextMonth);
          updateSearch(nextMonth, selectedDate);
        }}
        onCurrentMonth={() => {
          const nextMonth = dayjs();
          const nextDate = toIsoDate(nextMonth);
          setCurrentMonth(nextMonth);
          setSelectedDate(nextDate);
          updateSearch(nextMonth, nextDate);
        }}
        onNextMonth={() => {
          const nextMonth = currentMonth.add(1, "month");
          setCurrentMonth(nextMonth);
          updateSearch(nextMonth, selectedDate);
        }}
      />
      <p className="text-muted">{formatMonthYear(monthStart)} {m.calendar_subtitle()}</p>

      {loading ? <div className="alert alert-info py-2">{m.calendar_loading()}</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void loadCalendar()}>
              {m.action_retry()}
            </button>
          ) : null}
        </div>
      ) : null}
      {dayActionStatus || planned.actionStatus ? (
        <div className="alert alert-success py-2">{dayActionStatus ?? planned.actionStatus}</div>
      ) : null}
      {planned.addError && planned.editingPlannedItemId === null ? (
        <div className="alert alert-danger py-2">{planned.addError}</div>
      ) : null}

      <div className="row g-3">
        <div className="col-lg-7">
          <CalendarMonthGrid
            monthStart={monthStart}
            monthItems={monthItems}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              updateSearch(currentMonth, date);
            }}
            onDropReschedule={planned.dragReschedulePlannedItem}
          />
        </div>

        <div className="col-lg-5">
          <DayDetailsPanel
            selectedDate={selectedDate}
            dayItems={dayPayload?.items ?? []}
            isAdding={planned.isAdding || isRunningDayAction}
            onStartRoutine={(itemId) => runDayItemAction(() => startRoutineTask(itemId), m.action_start())}
            onCompleteRoutine={(itemId) =>
              runDayItemAction(() => completeRoutineTask(itemId), m.action_done())
            }
            onSkipRoutine={(itemId) => runDayItemAction(() => skipRoutineTask(itemId), m.action_skip())}
            onCompleteChore={(itemId) => runDayItemAction(() => completeChore(itemId), m.action_done())}
            onSkipChore={(itemId) => runDayItemAction(() => skipChore(itemId), m.action_skip())}
            onRescheduleChore={(itemId, scheduledDate) =>
              runDayItemAction(
                () => rescheduleChore(itemId, toIsoDate(dayjs(scheduledDate).add(1, "day"))),
                m.action_reschedule_1_day(),
              )
            }
          />

          <PlannedItemsSidebar
            selectedDate={selectedDate}
            plannedItems={planned.plannedItems}
            title={planned.title}
            timeOfDay={planned.timeOfDay}
            durationMinutes={planned.durationMinutes}
            notes={planned.notes}
            moduleKey={planned.moduleKey}
            recurrenceHint={planned.recurrenceHint}
            isRepeating={planned.isRepeating}
            repeatPreset={planned.repeatPreset}
            repeatWeekdays={planned.repeatWeekdays}
            customInterval={planned.customInterval}
            linkedSource={planned.linkedSource}
            linkedRef={planned.linkedRef}
            editingPlannedItemId={planned.editingPlannedItemId}
            editScope={planned.editScope}
            confirmDeleteId={planned.confirmDeleteId}
            isAdding={planned.isAdding || isRunningDayAction}
            addError={planned.addError}
            onSetTitle={(value) => {
              planned.setTitle(value);
              planned.setAddError(null);
            }}
            onSetTimeOfDay={(value) => {
              planned.setTimeOfDay(value);
              planned.setAddError(null);
            }}
            onSetDurationMinutes={(value) => {
              planned.setDurationMinutes(value);
              planned.setAddError(null);
            }}
            onSetNotes={(value) => {
              planned.setNotes(value);
              planned.setAddError(null);
            }}
            onSetModuleKey={(value) => {
              planned.setModuleKey(value);
              planned.setAddError(null);
            }}
            onSetRecurrenceHint={(value) => {
              planned.setRecurrenceHint(value);
              planned.setAddError(null);
            }}
            onSetIsRepeating={(value) => {
              planned.setIsRepeating(value);
              planned.setAddError(null);
            }}
            onSetRepeatPreset={(value) => {
              planned.setRepeatPreset(value);
              planned.setAddError(null);
            }}
            onSetRepeatWeekdays={(value) => {
              planned.setRepeatWeekdays(value);
              planned.setAddError(null);
            }}
            onSetCustomInterval={(value) => {
              planned.setCustomInterval(value);
              planned.setAddError(null);
            }}
            onSetLinkedSource={(value) => {
              planned.setLinkedSource(value);
              planned.setAddError(null);
            }}
            onSetLinkedRef={(value) => {
              planned.setLinkedRef(value);
              planned.setAddError(null);
            }}
            onSetEditScope={planned.setEditScope}
            onAddPlanned={planned.onAddPlanned}
            onCancelEdit={planned.resetPlannedForm}
            onToggleDone={planned.togglePlannedDone}
            onStartEdit={planned.startEditing}
            onSetConfirmDeleteId={planned.setConfirmDeleteId}
            onRemovePlannedItem={planned.removePlannedItem}
            isExporting={planned.isExporting}
            isImporting={planned.isImporting}
            backupStatus={planned.backupStatus}
            fileInputRef={planned.fileInputRef}
            onExportBackup={planned.onExportBackup}
            onImportFile={planned.onImportFile}
            onDropReschedule={planned.dragReschedulePlannedItem}
          />
        </div>
      </div>
    </section>
  );
}
