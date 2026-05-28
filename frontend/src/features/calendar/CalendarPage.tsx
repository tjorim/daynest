import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import {
  isRetryableApiError,
} from "@/lib/api/today";
import { dayjs, formatMonthYear, toIsoDate } from "@/lib/dateUtils";
import {
  CalendarMonthGrid,
  DayDetailsPanel,
  MonthNavigationControls,
  PlannedItemsSidebar,
} from "@/features/calendar/CalendarPageSections";
import {
  useCalendarDayQuery,
  useCalendarMonthQuery,
  useCalendarPlannedItemsQuery,
  useCompleteChoreMutation,
  useCompleteRoutineTaskMutation,
  useRescheduleChoreMutation,
  useSkipChoreMutation,
  useSkipRoutineTaskMutation,
  useStartRoutineTaskMutation,
} from "@/features/calendar/useCalendarQueries";
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
  const navigate = useNavigate({ from: "/protected/calendar" });
  const search = useSearch({ from: "/protected/calendar" });
  const currentMonth = useMemo(() => parseMonth(search.month) ?? dayjs(), [search.month]);
  const selectedDate = useMemo(() => toIsoDate(parseDate(search.date) ?? dayjs()), [search.date]);
  const [dayActionStatus, setDayActionStatus] = useState<string | null>(null);
  const [isRunningDayAction, setIsRunningDayAction] = useState(false);

  const monthKey = useMemo(
    () => ({ year: currentMonth.year(), month: currentMonth.month() + 1 }),
    [currentMonth],
  );
  const monthStart = currentMonth.startOf("month");
  const monthQuery = useCalendarMonthQuery(monthKey.year, monthKey.month);
  const dayQuery = useCalendarDayQuery(selectedDate);
  const plannedQuery = useCalendarPlannedItemsQuery(selectedDate);
  const startRoutineTaskMutation = useStartRoutineTaskMutation();
  const completeRoutineTaskMutation = useCompleteRoutineTaskMutation();
  const skipRoutineTaskMutation = useSkipRoutineTaskMutation();
  const completeChoreMutation = useCompleteChoreMutation();
  const skipChoreMutation = useSkipChoreMutation();
  const rescheduleChoreMutation = useRescheduleChoreMutation();

  const updateSearch = (nextMonth: dayjs.Dayjs, nextDate: string) => {
    void navigate({
      search: {
        month: nextMonth.format("YYYY-MM"),
        date: nextDate,
      },
      replace: true,
    });
  };

  const reloadCalendar = async () => {
    await Promise.all([monthQuery.refetch(), dayQuery.refetch(), plannedQuery.refetch()]);
  };

  const planned = useCalendarPlannedItems({
    selectedDate,
    monthStart,
    monthKey,
    loadCalendar: reloadCalendar,
  });

  useEffect(() => {
    planned.setPlannedItems(plannedQuery.data ?? []);
  }, [plannedQuery.data]);

  const runDayItemAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setDayActionStatus(null);
    planned.clearAddError();
    setIsRunningDayAction(true);
    try {
      await action();
      setDayActionStatus(successMessage);
    } catch (err) {
      planned.setAddError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setIsRunningDayAction(false);
    }
  };

  const loading = monthQuery.isPending || dayQuery.isPending || plannedQuery.isPending;
  const queryError = monthQuery.error ?? dayQuery.error ?? plannedQuery.error;
  const error = queryError instanceof Error ? queryError.message : queryError ? "Unable to load calendar view." : null;
  const canRetry = queryError ? isRetryableApiError(queryError) : false;

  return (
    <section>
      <MonthNavigationControls
        onRefresh={() => void reloadCalendar()}
        onPrevMonth={() => {
          const nextMonth = currentMonth.subtract(1, "month");
          updateSearch(nextMonth, selectedDate);
        }}
        onCurrentMonth={() => {
          const nextMonth = dayjs();
          const nextDate = toIsoDate(nextMonth);
          updateSearch(nextMonth, nextDate);
        }}
        onNextMonth={() => {
          const nextMonth = currentMonth.add(1, "month");
          updateSearch(nextMonth, selectedDate);
        }}
      />
      <p className="text-muted">{formatMonthYear(monthStart)} {m.calendar_subtitle()}</p>

      {loading ? <div className="alert alert-info py-2">{m.calendar_loading()}</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void reloadCalendar()}>
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
            monthItems={monthQuery.data?.days ?? []}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              updateSearch(currentMonth, date);
            }}
            onDropReschedule={planned.dragReschedulePlannedItem}
          />
        </div>

        <div className="col-lg-5">
          <DayDetailsPanel
            selectedDate={selectedDate}
            dayItems={dayQuery.data?.items ?? []}
            isAdding={planned.isAdding || isRunningDayAction}
            onStartRoutine={(itemId) =>
              runDayItemAction(() => startRoutineTaskMutation.mutateAsync(itemId), m.action_start())
            }
            onCompleteRoutine={(itemId) =>
              runDayItemAction(() => completeRoutineTaskMutation.mutateAsync(itemId), m.action_done())
            }
            onSkipRoutine={(itemId) =>
              runDayItemAction(() => skipRoutineTaskMutation.mutateAsync(itemId), m.action_skip())
            }
            onCompleteChore={(itemId) =>
              runDayItemAction(() => completeChoreMutation.mutateAsync(itemId), m.action_done())
            }
            onSkipChore={(itemId) => runDayItemAction(() => skipChoreMutation.mutateAsync(itemId), m.action_skip())}
            onRescheduleChore={(itemId, scheduledDate) =>
              runDayItemAction(
                () =>
                  rescheduleChoreMutation.mutateAsync({
                    choreInstanceId: itemId,
                    scheduledDate: toIsoDate(dayjs(scheduledDate).add(1, "day")),
                  }),
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
