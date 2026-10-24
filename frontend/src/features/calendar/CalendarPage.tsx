import "temporal-polyfill/global";
import { Temporal } from "temporal-polyfill";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  createViewDay,
  createViewMonthAgenda,
  createViewMonthGrid,
  createViewWeek,
} from "@schedule-x/calendar";
import { createDragAndDropPlugin } from "@/features/calendar/dragAndDropAdapter";
import { createEventModalPlugin } from "@schedule-x/event-modal";
import { ScheduleXCalendar, useCalendarApp } from "@schedule-x/react";
import * as m from "@/paraglide/messages";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useTheme } from "@/app/theme/ThemeContext";
import { isRetryableApiError } from "@/lib/api/http";
import type { UnifiedDayItem } from "@/lib/api/today";
import { dayjs, toIsoDate } from "@/lib/dateUtils";
import { CalendarEventModal } from "@/features/calendar/CalendarEventModal";
import { PlannedItemsSidebar } from "@/features/calendar/CalendarPageSections";
import { CALENDAR_COLORS, mapToScheduleXEvents } from "@/features/calendar/mapToScheduleXEvents";
import { useCalendarPlannedItems } from "@/features/calendar/useCalendarPlannedItems";
import {
  resolveCalendarSelectedDate,
  useCalendarDayQuery,
  useCalendarPlannedItemsQuery,
  useCompleteChoreMutation,
  useCompleteRoutineTaskMutation,
  useRescheduleChoreMutation,
  useSkipChoreMutation,
  useSkipRoutineTaskMutation,
  useStartRoutineTaskMutation,
} from "@/features/calendar/useCalendarQueries";
import { useCalendarRangeQuery } from "@/features/calendar/useCalendarRangeQuery";
import "@/features/calendar/calendar.css";
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

function calendarDateString(value: Temporal.ZonedDateTime | Temporal.PlainDate): string {
  return value instanceof Temporal.PlainDate ? value.toString() : value.toPlainDate().toString();
}

function parseDate(value?: string) {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() && parsed.format("YYYY-MM-DD") === value ? parsed : null;
}

const calendarDefinitions = Object.fromEntries(
  Object.entries(CALENDAR_COLORS).map(([id, color]) => [
    id,
    {
      colorName: id,
      lightColors: { main: color, container: `${color}22`, onContainer: "#212529" },
      darkColors: { main: color, container: `${color}44`, onContainer: "#f8f9fa" },
    },
  ]),
);

export function CalendarPage() {
  const { language } = useLanguage();
  const { resolvedTheme } = useTheme();
  // Only the first value seeds the config; later changes go through calendar.setTheme below, so
  // the config identity (and with it the calendar instance) stays stable.
  const [initialIsDark] = useState(() => resolvedTheme === "dark");
  const navigate = useNavigate();
  const search = useSearch({ from: "/protected/calendar" });
  // Resolved the same way the route loader resolves it, so the two can
  // never fetch different dates for the same navigation.
  const selectedDate = useMemo(() => resolveCalendarSelectedDate(search.date), [search.date]);
  const initialMonth = useMemo(
    () => parseDate(search.month ? `${search.month}-01` : undefined) ?? dayjs(),
    [search.month],
  );
  const [range, setRange] = useState(() => ({
    start: initialMonth.startOf("month").format("YYYY-MM-DD"),
    end: initialMonth.endOf("month").format("YYYY-MM-DD"),
  }));
  useEffect(() => {
    setRange({
      start: initialMonth.startOf("month").format("YYYY-MM-DD"),
      end: initialMonth.endOf("month").format("YYYY-MM-DD"),
    });
  }, [initialMonth]);
  const [selectedItem, setSelectedItem] = useState<UnifiedDayItem | null>(null);
  const [dayActionStatus, setDayActionStatus] = useState<string | null>(null);
  const [isRunningDayAction, setIsRunningDayAction] = useState(false);
  const rangeQuery = useCalendarRangeQuery(range);
  const dayQuery = useCalendarDayQuery(selectedDate);
  const plannedQuery = useCalendarPlannedItemsQuery(selectedDate);
  const startRoutineTaskMutation = useStartRoutineTaskMutation();
  const completeRoutineTaskMutation = useCompleteRoutineTaskMutation();
  const skipRoutineTaskMutation = useSkipRoutineTaskMutation();
  const completeChoreMutation = useCompleteChoreMutation();
  const skipChoreMutation = useSkipChoreMutation();
  const rescheduleChoreMutation = useRescheduleChoreMutation();

  const updateSearch = (date: string) =>
    void navigate({ to: "/calendar", search: { date, month: date.slice(0, 7) }, replace: true });
  const reloadCalendar = async () => {
    await Promise.all([rangeQuery.refetch(), dayQuery.refetch(), plannedQuery.refetch()]);
  };
  const monthDayjs = useMemo(() => dayjs(range.start), [range.start]);
  const planned = useCalendarPlannedItems({
    selectedDate,
    monthStart: monthDayjs,
    monthKey: { year: monthDayjs.year(), month: monthDayjs.month() + 1 },
    loadCalendar: reloadCalendar,
  });

  useEffect(() => planned.setPlannedItems(plannedQuery.data ?? []), [plannedQuery.data]);

  const itemsByEventId = useMemo(
    () =>
      new Map(
        (rangeQuery.data?.items ?? []).map((item) => [`${item.item_type}-${item.item_id}`, item]),
      ),
    [rangeQuery.data],
  );
  const liveRef = useRef({ itemsByEventId, planned });
  liveRef.current = { itemsByEventId, planned };
  const events = useMemo(
    () => mapToScheduleXEvents(rangeQuery.data?.items ?? []),
    [rangeQuery.data],
  );
  const plugins = useMemo(() => [createDragAndDropPlugin(), createEventModalPlugin()], []);
  const views = useMemo(
    () =>
      [createViewMonthGrid(), createViewWeek(), createViewDay(), createViewMonthAgenda()] as const,
    [],
  );

  const runDayItemAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setDayActionStatus(null);
    planned.clearAddError();
    setIsRunningDayAction(true);
    try {
      await action();
      setDayActionStatus(successMessage);
      setSelectedItem(null);
    } catch (err) {
      planned.setAddError(apiErrorMessage(err, m.ui_action_failed()));
    } finally {
      setIsRunningDayAction(false);
    }
  };

  const calendarConfig = useMemo(
    (): Parameters<typeof useCalendarApp>[0] => ({
      views: [...views],
      events,
      selectedDate: Temporal.PlainDate.from(selectedDate),
      locale: language === "nl" ? "nl-NL" : "en-US",
      isDark: initialIsDark,
      calendars: calendarDefinitions,
      callbacks: {
        onRangeUpdate: (nextRange) => {
          setRange({
            start: calendarDateString(nextRange.start),
            end: calendarDateString(nextRange.end),
          });
        },
        onSelectedDateUpdate: (date) => updateSearch(date.toString()),
        onEventClick: (event) =>
          setSelectedItem(liveRef.current.itemsByEventId.get(String(event.id)) ?? null),
        onEventUpdate: (event) => {
          if (event._type !== "planned") return;
          void liveRef.current.planned.dragReschedulePlannedItem(
            Number(event._itemId),
            calendarDateString(event.start as Temporal.ZonedDateTime | Temporal.PlainDate),
          );
        },
        onClickDate: (date) => {
          updateSearch(date.toString());
          liveRef.current.planned.resetPlannedForm();
        },
        onClickDateTime: (dateTime) => {
          updateSearch(dateTime.toPlainDate().toString());
          liveRef.current.planned.resetPlannedForm();
          liveRef.current.planned.setTimeOfDay(
            dateTime.toPlainTime().toString({ smallestUnit: "minute" }),
          );
        },
      },
    }),
    [views, events, selectedDate, language, calendarDefinitions, setRange, updateSearch],
  );
  const calendar = useCalendarApp(calendarConfig, plugins);
  // Stable reference: ScheduleXCalendar destroys and re-renders its entire
  // DOM tree whenever this object's identity changes, so an inline literal
  // here would tear down the calendar (including its toolbar) on every
  // CalendarPage re-render.
  const customComponents = useMemo(() => ({ eventModal: () => null }), []);

  useEffect(() => {
    calendar?.events.set(events);
  }, [calendar, events]);

  useEffect(() => {
    calendar?.setTheme(resolvedTheme);
  }, [calendar, resolvedTheme]);

  const loading = rangeQuery.isPending || dayQuery.isPending || plannedQuery.isPending;
  const queryError = rangeQuery.error ?? dayQuery.error ?? plannedQuery.error;
  const error = queryError ? apiErrorMessage(queryError, m.load_calendar_failed()) : null;

  return (
    <section>
      <div className="tw:flex tw:justify-between tw:items-center tw:gap-2 tw:mb-2">
        <h2 className="tw:text-h4 tw:font-medium tw:mb-0">{m.calendar_title()}</h2>
        <Button variant="outline-primary" size="sm" onClick={() => void reloadCalendar()}>
          {m.action_refresh()}
        </Button>
      </div>
      {loading ? (
        <Alert variant="info" className="tw:py-2">
          {m.calendar_loading()}
        </Alert>
      ) : null}
      {error ? (
        <Alert
          variant="danger"
          className="tw:py-2 tw:flex tw:justify-between tw:items-center tw:gap-2"
        >
          <span>{error}</span>
          {isRetryableApiError(queryError) ? (
            <Button variant="danger" size="sm" onClick={() => void reloadCalendar()}>
              {m.action_retry()}
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {dayActionStatus || planned.actionStatus ? (
        <Alert variant="success" className="tw:py-2">
          {dayActionStatus ?? planned.actionStatus}
        </Alert>
      ) : null}
      {planned.addError && planned.editingPlannedItemId === null ? (
        <Alert variant="danger" className="tw:py-2">
          {planned.addError}
        </Alert>
      ) : null}
      <div className="tw:grid tw:grid-cols-12 tw:gap-4">
        {/*
          schedule-x switches to its compact "small calendar" layout (hiding
          the Today/Previous/Next toolbar) once its container drops below
          700px. At the xl breakpoint the app's 1080px-capped .container
          leaves an 8/4 split just under that threshold, so the toolbar was
          permanently hidden on desktop. col-xl-9/col-xl-3 keeps it above
          700px.
        */}
        <div className="tw:col-span-12 tw:xl:col-span-9">
          <Card className="daynest-calendar tw:p-2" role="region" aria-label={m.calendar_title()}>
            <ScheduleXCalendar calendarApp={calendar} customComponents={customComponents} />
          </Card>
        </div>
        <div className="tw:col-span-12 tw:xl:col-span-3">
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
            onSetTitle={planned.setTitle}
            onSetTimeOfDay={planned.setTimeOfDay}
            onSetDurationMinutes={planned.setDurationMinutes}
            onSetNotes={planned.setNotes}
            onSetModuleKey={planned.setModuleKey}
            onSetRecurrenceHint={planned.setRecurrenceHint}
            onSetIsRepeating={planned.setIsRepeating}
            onSetRepeatPreset={planned.setRepeatPreset}
            onSetRepeatWeekdays={planned.setRepeatWeekdays}
            onSetCustomInterval={planned.setCustomInterval}
            onSetLinkedSource={planned.setLinkedSource}
            onSetLinkedRef={planned.setLinkedRef}
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
          />
        </div>
      </div>
      <CalendarEventModal
        item={selectedItem}
        isRunning={isRunningDayAction}
        onClose={() => setSelectedItem(null)}
        onStartRoutine={(id) =>
          void runDayItemAction(() => startRoutineTaskMutation.mutateAsync(id), m.action_start())
        }
        onCompleteRoutine={(id) =>
          void runDayItemAction(() => completeRoutineTaskMutation.mutateAsync(id), m.action_done())
        }
        onSkipRoutine={(id) =>
          void runDayItemAction(() => skipRoutineTaskMutation.mutateAsync(id), m.action_skip())
        }
        onCompleteChore={(id) =>
          void runDayItemAction(() => completeChoreMutation.mutateAsync(id), m.action_done())
        }
        onSkipChore={(id) =>
          void runDayItemAction(() => skipChoreMutation.mutateAsync(id), m.action_skip())
        }
        onRescheduleChore={(id, date) =>
          void runDayItemAction(
            () =>
              rescheduleChoreMutation.mutateAsync({
                choreInstanceId: id,
                scheduledDate: toIsoDate(dayjs(date).add(1, "day")),
              }),
            m.action_reschedule_1_day(),
          )
        }
        onEditPlanned={(id) => {
          const item = planned.plannedItems.find((candidate) => candidate.id === id);
          if (item) planned.startEditing(item);
          setSelectedItem(null);
        }}
      />
    </section>
  );
}
