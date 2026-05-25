import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as m from "@/paraglide/messages";
import {
  fetchAnalyticsSummary,
  isRetryableApiError,
  type AnalyticsPeriod,
  type AnalyticsSummary,
  type DailyCount,
} from "@/lib/api/today";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function shortDate(date: string): string {
  return date.slice(5);
}

interface AdherenceEntry {
  date: string;
  taken: number;
  total: number;
  adherence_rate: number;
}

export function StatsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("week");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const periods: { value: AnalyticsPeriod; label: string }[] = [
    { value: "week", label: m.stats_period_week() },
    { value: "month", label: m.stats_period_month() },
    { value: "quarter", label: m.stats_period_quarter() },
    { value: "year", label: m.stats_period_year() },
  ];

  const load = (p: AnalyticsPeriod) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    setLoading(true);
    setError(null);
    setCanRetry(false);
    fetchAnalyticsSummary(p, signal)
      .then((data) => {
        if (!signal.aborted) setSummary(data);
      })
      .catch((err) => {
        if (!signal.aborted) {
          setCanRetry(isRetryableApiError(err));
          setError(err instanceof Error ? err.message : "Unable to load analytics.");
        }
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });
  };

  useEffect(() => {
    load(period);
    return () => controllerRef.current?.abort();
  }, [period]);

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-3">
        <h2 className="h4 mb-0">{m.stats_title()}</h2>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <div className="btn-group btn-group-sm" role="group" aria-label={m.stats_title()}>
            {periods.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`btn ${period === p.value ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={loading}
            onClick={() => load(period)}
          >
            {m.action_refresh()}
          </button>
        </div>
      </div>

      {loading ? <div className="alert alert-info py-2">{m.stats_loading()}</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => load(period)}
            >
              {m.action_retry()}
            </button>
          ) : null}
        </div>
      ) : null}

      {summary ? (
        <div className="row g-3">
          <div className="col-12">
            <div className="card">
              <div className="card-header fw-semibold py-2">
                {m.stats_completion_header({ start: summary.start_date, end: summary.end_date })}
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-sm-3">
                    <div className="text-center p-2">
                      <div className="fs-4 fw-bold text-primary">{pct(summary.chores.completion_rate)}</div>
                      <div className="small text-muted mt-1">{m.stats_chores()}</div>
                      <div className="small text-muted">
                        {summary.chores.total_completed}/{summary.chores.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="text-center p-2">
                      <div className="fs-4 fw-bold text-success">{pct(summary.routines.completion_rate)}</div>
                      <div className="small text-muted mt-1">{m.stats_routines()}</div>
                      <div className="small text-muted">
                        {summary.routines.total_completed}/{summary.routines.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="text-center p-2">
                      <div className="fs-4 fw-bold text-info">{pct(summary.medications.adherence_rate)}</div>
                      <div className="small text-muted mt-1">{m.stats_medication()}</div>
                      <div className="small text-muted">
                        {summary.medications.total_taken}/{summary.medications.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="text-center p-2">
                      <div className="fs-4 fw-bold text-warning">{pct(summary.planned_items.completion_rate)}</div>
                      <div className="small text-muted mt-1">{m.stats_planned_items()}</div>
                      <div className="small text-muted">
                        {summary.planned_items.total_completed}/{summary.planned_items.total_scheduled}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header fw-semibold py-2">{m.stats_streak_header()}</div>
              <ul className="list-group list-group-flush">
                {summary.chores.streaks.length === 0 && summary.routines.streaks.length === 0 ? (
                  <li className="list-group-item py-2 text-muted">{m.stats_no_streaks()}</li>
                ) : (
                  [
                    ...summary.chores.streaks.map((s) => ({
                      key: `chore-${s.chore_id}`,
                      name: s.name,
                      current: s.current_streak,
                      best: s.longest_streak,
                      type: m.stats_chore_type(),
                    })),
                    ...summary.routines.streaks.map((s) => ({
                      key: `routine-${s.routine_id}`,
                      name: s.name,
                      current: s.current_streak,
                      best: s.longest_streak,
                      type: m.stats_routine_type(),
                    })),
                  ]
                    .sort((a, b) => b.current - a.current)
                    .map((item) => (
                      <li key={item.key} className="list-group-item py-2">
                        <div className="d-flex justify-content-between align-items-center gap-2">
                          <div>
                            <div className="fw-semibold">{item.name}</div>
                            <small className="text-muted">{item.type}</small>
                          </div>
                          <div className="text-end">
                            {item.current > 0 ? (
                              <span className="badge text-bg-warning me-1">🔥 {item.current}</span>
                            ) : null}
                            <small className="text-muted d-block">{m.stats_best({ count: item.best })}</small>
                          </div>
                        </div>
                      </li>
                    ))
                )}
              </ul>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header fw-semibold py-2">{m.stats_most_skipped_header()}</div>
              <ul className="list-group list-group-flush">
                {summary.chores.most_skipped.length === 0 ? (
                  <li className="list-group-item py-2 text-muted">{m.stats_no_skipped()}</li>
                ) : (
                  summary.chores.most_skipped.map((item) => (
                    <li key={item.chore_id} className="list-group-item py-2">
                      <div className="d-flex justify-content-between align-items-center gap-2">
                        <div className="fw-semibold">{item.name}</div>
                        <span className="badge text-bg-secondary">
                          {item.skip_count === 1
                            ? m.stats_skip({ count: item.skip_count })
                            : m.stats_skips({ count: item.skip_count })}
                        </span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          {summary.chores.daily_completions.length > 0 ? (
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header fw-semibold py-2">{m.stats_chores_daily_header()}</div>
                <div className="card-body pb-2">
                  <CompletionChart entries={summary.chores.daily_completions} color="var(--bs-primary)" fillColor="rgba(var(--bs-primary-rgb), 0.2)" />
                </div>
              </div>
            </div>
          ) : null}

          {summary.routines.daily_completions.length > 0 ? (
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header fw-semibold py-2">{m.stats_routines_daily_header()}</div>
                <div className="card-body pb-2">
                  <CompletionChart entries={summary.routines.daily_completions} color="var(--bs-success)" fillColor="rgba(var(--bs-success-rgb), 0.2)" />
                </div>
              </div>
            </div>
          ) : null}

          {summary.medications.daily_adherence.length > 0 ? (
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header fw-semibold py-2">{m.stats_medication_adherence_header()}</div>
                <div className="card-body pb-2">
                  <AdherenceChart entries={summary.medications.daily_adherence} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CompletionChart({ entries, color, fillColor }: { entries: DailyCount[]; color: string; fillColor: string }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={entries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bs-border-color)" />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fontSize: 10, fill: "var(--bs-secondary-color)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          domain={[0, 1]}
          width={38}
          tick={{ fontSize: 10, fill: "var(--bs-secondary-color)" }}
          tickLine={false}
        />
        <Tooltip
          formatter={(v: unknown) => [`${Math.round((v as number) * 100)}%`, m.stats_completion_tooltip()]}
          labelFormatter={(l: unknown) => String(l)}
          contentStyle={{
            background: "var(--bs-body-bg)",
            border: "1px solid var(--bs-border-color)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="completion_rate"
          stroke={color}
          fill={fillColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function AdherenceChart({ entries }: { entries: AdherenceEntry[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={entries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bs-border-color)" />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fontSize: 10, fill: "var(--bs-secondary-color)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          domain={[0, 1]}
          width={38}
          tick={{ fontSize: 10, fill: "var(--bs-secondary-color)" }}
          tickLine={false}
        />
        <Tooltip
          formatter={(v: unknown) => [`${Math.round((v as number) * 100)}%`, m.stats_adherence_tooltip()]}
          labelFormatter={(l: unknown) => String(l)}
          contentStyle={{
            background: "var(--bs-body-bg)",
            border: "1px solid var(--bs-border-color)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="adherence_rate"
          stroke="var(--bs-info)"
          fill="rgba(var(--bs-info-rgb), 0.2)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
