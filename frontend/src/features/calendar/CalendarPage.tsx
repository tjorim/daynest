import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  completeChore,
  completeRoutineTask,
  createPlannedItem,
  deletePlannedItem,
  fetchCalendarDay,
  fetchCalendarMonth,
  isRetryableApiError,
  listPlannedItems,
  rescheduleChore,
  skipRoutineTask,
  skipChore,
  startRoutineTask,
  updatePlannedItem,
  type CalendarDayPayload,
  type CalendarMonthDaySummary,
  type PlannedItemBackupFile,
  type PlannedTodayItem,
  type PlannedItemModuleKey,
} from '../../lib/api/today';
import { capitalize, dayjs, formatDate, formatMonthYear, toIsoDate } from '../../lib/dateUtils';

function itemBadgeClass(itemType: string): string {
  if (itemType === 'medication') return 'text-bg-info';
  if (itemType === 'routine') return 'text-bg-primary';
  if (itemType === 'chore') return 'text-bg-warning';
  return 'text-bg-secondary';
}

function safeParseBackup(raw: string): PlannedItemBackupFile {
  const parsed = JSON.parse(raw) as Partial<PlannedItemBackupFile>;
  if (parsed.source !== 'daynest' || parsed.schema_version !== 1 || !Array.isArray(parsed.items)) {
    throw new Error('Unsupported backup file.');
  }
  parsed.items.forEach((item, index) => {
    if (!item || typeof item.title !== 'string' || typeof item.planned_for !== 'string') {
      throw new Error(`Invalid backup item at index ${index}: title and planned_for are required.`);
    }
  });
  return parsed as PlannedItemBackupFile;
}

function formatPlannedMeta(item: PlannedTodayItem): string {
  const values = [
    item.is_done ? 'Done' : 'Planned',
    item.module_key ? `Module: ${item.module_key}` : null,
    item.recurrence_hint ? `Repeat: ${item.recurrence_hint}` : null,
    item.linked_source ? `Source: ${item.linked_source}` : null,
  ];

  return values.filter(Boolean).join(' • ');
}

function dayItemStatusClass(status: string): string {
  if (status === 'done' || status === 'completed' || status === 'taken') return 'text-bg-success';
  if (status === 'pending') return 'text-bg-warning';
  if (status === 'scheduled') return 'text-bg-info';
  if (status === 'missed') return 'text-bg-danger';
  return 'text-bg-secondary';
}

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => dayjs());
  const [monthItems, setMonthItems] = useState<CalendarMonthDaySummary[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(dayjs()));
  const [dayPayload, setDayPayload] = useState<CalendarDayPayload | null>(null);
  const [plannedItems, setPlannedItems] = useState<PlannedTodayItem[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [moduleKey, setModuleKey] = useState<PlannedItemModuleKey | ''>('');
  const [recurrenceHint, setRecurrenceHint] = useState('');
  const [linkedSource, setLinkedSource] = useState('');
  const [linkedRef, setLinkedRef] = useState('');
  const [editingPlannedItemId, setEditingPlannedItemId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const monthKey = useMemo(() => ({ year: currentMonth.year(), month: currentMonth.month() + 1 }), [currentMonth]);

  const loadCalendar = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setCanRetry(false);

    try {
      const [month, day, selectedPlanned] = await Promise.all([
        fetchCalendarMonth(monthKey.year, monthKey.month, signal),
        fetchCalendarDay(selectedDate, signal),
        listPlannedItems(selectedDate, selectedDate),
      ]);
      setMonthItems(month.days);
      setDayPayload(day);
      setPlannedItems(selectedPlanned);
    } catch (err) {
      if (!signal?.aborted) {
        setCanRetry(isRetryableApiError(err));
        setError(err instanceof Error ? err.message : 'Unable to load calendar view.');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadCalendar(controller.signal);
    return () => controller.abort();
  }, [monthKey.month, monthKey.year, selectedDate]);

  const itemsByDate = useMemo(() => {
    return new Map(monthItems.map((item) => [item.date, item]));
  }, [monthItems]);

  const monthStart = currentMonth.startOf('month');
  const daysInMonth = monthStart.daysInMonth();
  const leadingEmptyDays = (monthStart.day() + 6) % 7;
  const totalCalendarCells = Math.ceil((leadingEmptyDays + daysInMonth) / 7) * 7;

  const onAddPlanned = async () => {
    if (!title.trim()) return;
    setIsAdding(true);
    setAddError(null);
    setActionStatus(null);
    try {
      const payload = {
        title: title.trim(),
        planned_for: selectedDate,
        notes: notes.trim() || null,
        module_key: moduleKey || null,
        recurrence_hint: recurrenceHint.trim() || null,
        linked_source: linkedSource.trim() || null,
        linked_ref: linkedRef.trim() || null,
      };

      if (editingPlannedItemId) {
        const currentItem = plannedItems.find((item) => item.id === editingPlannedItemId);
        await updatePlannedItem(editingPlannedItemId, {
          ...payload,
          is_done: currentItem?.is_done ?? false,
        });
      } else {
        await createPlannedItem(payload);
      }

      setTitle('');
      setNotes('');
      setModuleKey('');
      setRecurrenceHint('');
      setLinkedSource('');
      setLinkedRef('');
      resetPlannedForm();
      setActionStatus(editingPlannedItemId ? 'Planned item updated.' : 'Planned item created.');
      await loadCalendar();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : `Failed to ${editingPlannedItemId ? 'update' : 'add'} item.`);
    } finally {
      setIsAdding(false);
    }
  };

  const startEditing = (item: PlannedTodayItem) => {
    setEditingPlannedItemId(item.id);
    setTitle(item.title);
    setNotes(item.notes ?? '');
    setModuleKey(item.module_key ?? '');
    setRecurrenceHint(item.recurrence_hint ?? '');
    setLinkedSource(item.linked_source ?? '');
    setLinkedRef(item.linked_ref ?? '');
    setAddError(null);
  };

  const resetPlannedForm = () => {
    setEditingPlannedItemId(null);
    setTitle('');
    setNotes('');
    setModuleKey('');
    setRecurrenceHint('');
    setLinkedSource('');
    setLinkedRef('');
    setAddError(null);
  };

  const togglePlannedDone = async (item: PlannedTodayItem) => {
    setAddError(null);
    setIsAdding(true);
    setActionStatus(null);
    try {
      await updatePlannedItem(item.id, {
        title: item.title,
        planned_for: item.planned_for,
        notes: item.notes,
        module_key: item.module_key,
        recurrence_hint: item.recurrence_hint,
        linked_source: item.linked_source,
        linked_ref: item.linked_ref,
        is_done: !item.is_done,
      });
      setActionStatus(item.is_done ? 'Planned item reopened.' : 'Planned item marked done.');
      await loadCalendar();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to update item.');
    } finally {
      setIsAdding(false);
    }
  };

  const removePlannedItem = async (itemId: number) => {
    if (!window.confirm('Delete this planned item?')) {
      return;
    }
    setAddError(null);
    setIsAdding(true);
    setActionStatus(null);
    try {
      await deletePlannedItem(itemId);
      if (editingPlannedItemId === itemId) {
        resetPlannedForm();
      }
      setActionStatus('Planned item deleted.');
      await loadCalendar();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to delete item.');
    } finally {
      setIsAdding(false);
    }
  };

  const onExportBackup = async () => {
    setIsExporting(true);
    setBackupStatus(null);
    try {
      const startDate = monthStart.format('YYYY-MM-DD');
      const endDate = monthStart.endOf('month').format('YYYY-MM-DD');
      const items = await listPlannedItems(startDate, endDate);
      const payload: PlannedItemBackupFile = {
        source: 'daynest',
        schema_version: 1,
        exported_at: dayjs().toISOString(),
        items: items.map((item) => ({
          title: item.title,
          planned_for: item.planned_for,
          notes: item.notes,
          module_key: item.module_key,
          recurrence_hint: item.recurrence_hint,
          linked_source: item.linked_source,
          linked_ref: item.linked_ref,
        })),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `daynest-backup-${monthKey.year}-${String(monthKey.month).padStart(2, '0')}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      setBackupStatus(`Exported ${payload.items.length} planned items.`);
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const runDayItemAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setActionStatus(null);
    setAddError(null);
    setIsAdding(true);
    try {
      await action();
      setActionStatus(successMessage);
      await loadCalendar();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setIsAdding(false);
    }
  };

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) {
      return;
    }

    setIsImporting(true);
    setBackupStatus(null);

    try {
      const raw = await selected.text();
      const backup = safeParseBackup(raw);

      let imported = 0;
      let failed = 0;

      for (let start = 0; start < backup.items.length; start += 5) {
        const batch = backup.items.slice(start, start + 5);
        const results = await Promise.allSettled(
          batch.map((item) =>
            createPlannedItem({
              title: item.title,
              planned_for: item.planned_for,
              notes: item.notes,
              module_key: item.module_key,
              recurrence_hint: item.recurrence_hint,
              linked_source: item.linked_source,
              linked_ref: item.linked_ref,
            }),
          ),
        );
        for (const result of results) {
          if (result.status === 'fulfilled') {
            imported += 1;
          } else {
            failed += 1;
          }
        }
      }

      await loadCalendar();
      setBackupStatus(`Import complete. ${imported} imported${failed ? `, ${failed} failed` : ''}.`);
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setIsImporting(false);
    }
  };

  return (
    <section>
      <div className="d-flex flex-column gap-2 mb-2">
        <div className="d-flex justify-content-between align-items-center">
          <h2 className="h4 mb-0">Calendar</h2>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void loadCalendar()}>
            Refresh
          </button>
        </div>
        <div className="btn-group btn-group-sm w-100" role="group" aria-label="Quick month controls">
          <button type="button" className="btn btn-outline-secondary" onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}>
            Prev
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setCurrentMonth(dayjs())}>
            This month
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}>
            Next
          </button>
        </div>
      </div>
      <p className="text-muted">{formatMonthYear(monthStart)} unified month/day planning view.</p>

      {loading ? <div className="alert alert-info py-2">Loading calendar...</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void loadCalendar()}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {actionStatus ? <div className="alert alert-success py-2">{actionStatus}</div> : null}
      {addError && !editingPlannedItemId ? <div className="alert alert-danger py-2">{addError}</div> : null}

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card">
            <div className="card-body p-2 p-md-3">
              <div className="row row-cols-7 g-1 g-md-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((weekday) => (
                  <div key={weekday} className="col text-center small fw-semibold text-muted">
                    {weekday}
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
                  return (
                    <div key={dateValue} className="col">
                      <button
                        type="button"
                        className={`btn w-100 text-start py-2 ${selected ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setSelectedDate(dateValue)}
                      >
                        <div className="fw-semibold lh-1">{dayNumber}</div>
                        <small>{summary ? `${summary.total} items` : 'No items'}</small>
                        {summary ? (
                          <div className="calendar-cell-meta mt-2">
                            {summary.routines ? <span className="badge text-bg-primary-subtle text-primary-emphasis">{summary.routines}R</span> : null}
                            {summary.chores ? <span className="badge text-bg-warning-subtle text-warning-emphasis">{summary.chores}C</span> : null}
                            {summary.medications ? <span className="badge text-bg-info-subtle text-info-emphasis">{summary.medications}M</span> : null}
                            {summary.planned ? <span className="badge text-bg-secondary">{summary.planned}P</span> : null}
                          </div>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">Day details · {formatDate(selectedDate)}</div>
            <ul className="list-group list-group-flush">
              {(dayPayload?.items ?? []).length === 0 ? (
                <li className="list-group-item py-2 text-muted">No items for this day.</li>
              ) : (
                dayPayload?.items.map((item) => (
                  <li key={`${item.item_type}-${item.item_id}`} className="list-group-item py-2">
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <div className="fw-semibold">{item.title}</div>
                        <small className="text-muted">{capitalize(item.status)}</small>
                        {item.detail ? <small className="d-block">{item.detail}</small> : null}
                        {item.module_key ? <small className="d-block text-muted">Module: {item.module_key}</small> : null}
                        <div className="d-flex gap-2 flex-wrap mt-2">
                          {item.item_type === 'routine' && item.status === 'pending' ? (
                            <button type="button" className="btn btn-outline-primary btn-sm" disabled={isAdding} onClick={() => void runDayItemAction(() => startRoutineTask(item.item_id), 'Routine started.')}>
                              Start
                            </button>
                          ) : null}
                          {item.item_type === 'routine' && item.status !== 'completed' && item.status !== 'skipped' ? (
                            <>
                              <button type="button" className="btn btn-success btn-sm" disabled={isAdding} onClick={() => void runDayItemAction(() => completeRoutineTask(item.item_id), 'Routine completed.')}>
                                Done
                              </button>
                              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={isAdding} onClick={() => void runDayItemAction(() => skipRoutineTask(item.item_id), 'Routine skipped.')}>
                                Skip
                              </button>
                            </>
                          ) : null}
                          {item.item_type === 'chore' && item.status === 'pending' ? (
                            <>
                              <button type="button" className="btn btn-success btn-sm" disabled={isAdding} onClick={() => void runDayItemAction(() => completeChore(item.item_id), 'Chore completed.')}>
                                Done
                              </button>
                              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={isAdding} onClick={() => void runDayItemAction(() => skipChore(item.item_id), 'Chore skipped.')}>
                                Skip
                              </button>
                              {item.scheduled_date ? (
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm"
                                  disabled={isAdding}
                                  onClick={() =>
                                    void runDayItemAction(
                                      () => rescheduleChore(item.item_id, toIsoDate(dayjs(item.scheduled_date).add(1, 'day'))),
                                      'Chore rescheduled.',
                                    )
                                  }
                                >
                                  +1 day
                                </button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="d-grid gap-1 justify-items-end">
                        <span className={`badge ${itemBadgeClass(item.item_type)}`}>{item.item_type}</span>
                        <span className={`badge ${dayItemStatusClass(item.status)}`}>{capitalize(item.status)}</span>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">Quick add planned item</div>
            <div className="card-body d-grid gap-3">
              <div className="d-grid gap-2">
                <input
                  className="form-control"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setAddError(null);
                  }}
                  placeholder="Plan title"
                />
                <textarea
                  className="form-control"
                  rows={3}
                  value={notes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setAddError(null);
                  }}
                  placeholder="Notes"
                />
                <select
                  className="form-select"
                  value={moduleKey}
                  onChange={(event) => {
                    setModuleKey(event.target.value as PlannedItemModuleKey | '');
                    setAddError(null);
                  }}
                  aria-label="Optional module"
                >
                  <option value="">General</option>
                  <option value="shopping_list">Shopping list</option>
                  <option value="meal_planning">Meal planning</option>
                  <option value="recurring_grocery">Recurring grocery</option>
                  <option value="shared_calendar">Shared calendar</option>
                </select>
                <input
                  className="form-control"
                  value={recurrenceHint}
                  onChange={(event) => {
                    setRecurrenceHint(event.target.value);
                    setAddError(null);
                  }}
                  placeholder="Recurrence hint (optional)"
                />
                <input
                  className="form-control"
                  value={linkedSource}
                  onChange={(event) => {
                    setLinkedSource(event.target.value);
                    setAddError(null);
                  }}
                  placeholder="Linked source (optional)"
                />
                <input
                  className="form-control"
                  value={linkedRef}
                  onChange={(event) => {
                    setLinkedRef(event.target.value);
                    setAddError(null);
                  }}
                  placeholder="Linked reference (optional)"
                />
              </div>
              <div className="d-flex gap-2 flex-column flex-sm-row">
                <button type="button" className="btn btn-primary" disabled={isAdding} onClick={() => void onAddPlanned()}>
                  {isAdding ? (editingPlannedItemId ? 'Saving…' : 'Adding…') : editingPlannedItemId ? 'Save item' : 'Add item'}
                </button>
                {editingPlannedItemId ? (
                  <button type="button" className="btn btn-outline-secondary" disabled={isAdding} onClick={resetPlannedForm}>
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </div>
            {addError ? <div className="card-footer text-danger py-2 small">{addError}</div> : null}
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">Planned items · {formatDate(selectedDate)}</div>
            <ul className="list-group list-group-flush">
              {plannedItems.length === 0 ? (
                <li className="list-group-item py-2 text-muted">No planned items for this day.</li>
              ) : (
                plannedItems.map((item) => (
                  <li key={item.id} className="list-group-item py-2">
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <div className="fw-semibold">{item.title}</div>
                        <small className="text-muted d-block">{formatPlannedMeta(item)}</small>
                        {item.notes ? <small className="d-block mt-1">{item.notes}</small> : null}
                        {item.linked_ref ? <small className="d-block text-muted">Ref: {item.linked_ref}</small> : null}
                      </div>
                      <div className="d-grid gap-2">
                        <button
                          type="button"
                          className={`btn btn-sm ${item.is_done ? 'btn-outline-success' : 'btn-success'}`}
                          disabled={isAdding}
                          onClick={() => void togglePlannedDone(item)}
                        >
                          {item.is_done ? 'Undo' : 'Done'}
                        </button>
                        <button type="button" className="btn btn-outline-primary btn-sm" disabled={isAdding} onClick={() => startEditing(item)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-outline-danger btn-sm" disabled={isAdding} onClick={() => void removePlannedItem(item.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="card">
            <div className="card-header fw-semibold py-2">Backup export/import</div>
            <div className="card-body">
              <div className="d-flex flex-column flex-sm-row gap-2">
                <button type="button" className="btn btn-outline-primary" disabled={isExporting || isImporting} onClick={() => void onExportBackup()}>
                  {isExporting ? 'Exporting…' : 'Export month backup'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={isExporting || isImporting}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isImporting ? 'Importing…' : 'Import backup'}
                </button>
                <input ref={fileInputRef} type="file" accept="application/json" className="d-none" onChange={(event) => void onImportFile(event)} />
              </div>
              {backupStatus ? <small className="text-muted d-block mt-2">{backupStatus}</small> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
