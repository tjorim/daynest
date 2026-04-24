import { useEffect, useMemo, useState } from 'react';
import {
  createPlannedItem,
  fetchCalendarDay,
  fetchCalendarMonth,
  type CalendarDayPayload,
  type CalendarMonthDaySummary,
} from '../../lib/api/today';

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function itemBadgeClass(itemType: string): string {
  if (itemType === 'medication') return 'text-bg-info';
  if (itemType === 'routine') return 'text-bg-primary';
  if (itemType === 'chore') return 'text-bg-warning';
  return 'text-bg-secondary';
}

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [monthItems, setMonthItems] = useState<CalendarMonthDaySummary[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const [dayPayload, setDayPayload] = useState<CalendarDayPayload | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthKey = useMemo(() => ({ year: currentMonth.getFullYear(), month: currentMonth.getMonth() + 1 }), [currentMonth]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      fetchCalendarMonth(monthKey.year, monthKey.month, controller.signal),
      fetchCalendarDay(selectedDate, controller.signal),
    ])
      .then(([month, day]) => {
        setMonthItems(month.days);
        setDayPayload(day);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Unable to load calendar view.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [monthKey.month, monthKey.year, selectedDate]);

  const itemsByDate = useMemo(() => {
    return new Map(monthItems.map((item) => [item.date, item]));
  }, [monthItems]);

  const firstDay = new Date(monthKey.year, monthKey.month - 1, 1);
  const lastDay = new Date(monthKey.year, monthKey.month, 0);
  const daysInMonth = lastDay.getDate();

  const onAddPlanned = async () => {
    if (!title.trim()) return;
    await createPlannedItem({ title: title.trim(), planned_for: selectedDate });
    setTitle('');
    const [month, day] = await Promise.all([fetchCalendarMonth(monthKey.year, monthKey.month), fetchCalendarDay(selectedDate)]);
    setMonthItems(month.days);
    setDayPayload(day);
  };

  return (
    <section>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h4 mb-0">Calendar</h2>
        <div className="btn-group btn-group-sm">
          <button type="button" className="btn btn-outline-secondary" onClick={() => setCurrentMonth(new Date(monthKey.year, monthKey.month - 2, 1))}>
            Prev
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setCurrentMonth(new Date())}>
            Today
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setCurrentMonth(new Date(monthKey.year, monthKey.month, 1))}>
            Next
          </button>
        </div>
      </div>
      <p className="text-muted">{monthLabel(firstDay)} unified month/day planning view.</p>

      {loading ? <div className="alert alert-info">Loading calendar...</div> : null}
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card">
            <div className="card-body">
              <div className="row row-cols-7 g-2">
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNumber = idx + 1;
                  const dateValue = toIsoDate(new Date(monthKey.year, monthKey.month - 1, dayNumber));
                  const summary = itemsByDate.get(dateValue);
                  const selected = selectedDate === dateValue;
                  return (
                    <div key={dateValue} className="col">
                      <button
                        type="button"
                        className={`btn w-100 text-start ${selected ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setSelectedDate(dateValue)}
                      >
                        <div className="fw-semibold">{dayNumber}</div>
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
            <div className="card-header fw-semibold">Day details · {selectedDate}</div>
            <ul className="list-group list-group-flush">
              {(dayPayload?.items ?? []).length === 0 ? (
                <li className="list-group-item text-muted">No items for this day.</li>
              ) : (
                dayPayload?.items.map((item) => (
                  <li key={`${item.item_type}-${item.item_id}`} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-semibold">{item.title}</div>
                        <small className="text-muted">{item.status}</small>
                        {item.detail ? <small className="d-block">{item.detail}</small> : null}
                      </div>
                      <span className={`badge ${itemBadgeClass(item.item_type)}`}>{item.item_type}</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="card">
            <div className="card-header fw-semibold">Quick add planned item</div>
            <div className="card-body d-flex gap-2">
              <input
                className="form-control"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Plan title"
              />
              <button type="button" className="btn btn-primary" onClick={() => void onAddPlanned()}>
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
