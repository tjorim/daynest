import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  createPlannedItem,
  fetchCalendarDay,
  fetchCalendarMonth,
  isRetryableApiError,
  listPlannedItems,
  type CalendarDayPayload,
  type CalendarMonthDaySummary,
  type PlannedItemBackupFile,
  type PlannedItemModuleKey,
} from '../../lib/api/today';
import { dayjs } from '../../lib/dateUtils';

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
  return parsed as PlannedItemBackupFile;
}

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => dayjs());
  const [monthItems, setMonthItems] = useState<CalendarMonthDaySummary[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [dayPayload, setDayPayload] = useState<CalendarDayPayload | null>(null);
  const [title, setTitle] = useState('');
  const [moduleKey, setModuleKey] = useState<PlannedItemModuleKey | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const monthKey = useMemo(() => ({ year: currentMonth.year(), month: currentMonth.month() + 1 }), [currentMonth]);

  const loadCalendar = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setCanRetry(false);

    try {
      const [month, day] = await Promise.all([
        fetchCalendarMonth(monthKey.year, monthKey.month, signal),
        fetchCalendarDay(selectedDate, signal),
      ]);
      setMonthItems(month.days);
      setDayPayload(day);
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

  const onAddPlanned = async () => {
    if (!title.trim()) return;
    setIsAdding(true);
    setAddError(null);
    try {
      await createPlannedItem({
        title: title.trim(),
        planned_for: selectedDate,
        module_key: moduleKey || null,
      });
      setTitle('');
      setModuleKey('');
      await loadCalendar();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add item.');
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

      for (const item of backup.items) {
        try {
          await createPlannedItem({
            title: item.title,
            planned_for: item.planned_for,
            notes: item.notes,
            module_key: item.module_key,
            recurrence_hint: item.recurrence_hint,
            linked_source: item.linked_source,
            linked_ref: item.linked_ref,
          });
          imported += 1;
        } catch {
          failed += 1;
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
      <p className="text-muted">{monthStart.format('MMMM YYYY')} unified month/day planning view.</p>

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

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card">
            <div className="card-body p-2 p-md-3">
              <div className="row row-cols-7 g-1 g-md-2">
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNumber = idx + 1;
                  const dateValue = monthStart.date(dayNumber).format('YYYY-MM-DD');
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
            <div className="card-header fw-semibold py-2">Day details · {selectedDate}</div>
            <ul className="list-group list-group-flush">
              {(dayPayload?.items ?? []).length === 0 ? (
                <li className="list-group-item py-2 text-muted">No items for this day.</li>
              ) : (
                dayPayload?.items.map((item) => (
                  <li key={`${item.item_type}-${item.item_id}`} className="list-group-item py-2">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-semibold">{item.title}</div>
                        <small className="text-muted">{item.status}</small>
                        {item.detail ? <small className="d-block">{item.detail}</small> : null}
                        {item.module_key ? <small className="d-block text-muted">Module: {item.module_key}</small> : null}
                      </div>
                      <span className={`badge ${itemBadgeClass(item.item_type)}`}>{item.item_type}</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">Quick add planned item</div>
            <div className="card-body d-flex gap-2 flex-column flex-sm-row">
              <input
                className="form-control"
                value={title}
                onChange={(event) => { setTitle(event.target.value); setAddError(null); }}
                placeholder="Plan title"
              />
              <select className="form-select" value={moduleKey} onChange={(event) => { setModuleKey(event.target.value as PlannedItemModuleKey | ''); setAddError(null); }} aria-label="Optional module">
                <option value="">General</option>
                <option value="shopping_list">Shopping list</option>
                <option value="meal_planning">Meal planning</option>
                <option value="recurring_grocery">Recurring grocery</option>
                <option value="shared_calendar">Shared calendar</option>
              </select>
              <button type="button" className="btn btn-primary" disabled={isAdding} onClick={() => void onAddPlanned()}>
                {isAdding ? 'Adding…' : 'Add'}
              </button>
            </div>
            {addError ? <div className="card-footer text-danger py-2 small">{addError}</div> : null}
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
