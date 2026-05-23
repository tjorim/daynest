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
import {
  fetchAnalyticsSummary,
  isRetryableApiError,
  type AnalyticsPeriod,
  type AnalyticsSummary,
  type DailyCount,
} from "@/lib/api/today";

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "3 Months" },
  { value: "year", label: "Year" },
];

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
        <h2 className="h4 mb-0">Statistics</h2>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <div className="btn-group btn-group-sm" role="group" aria-label="Period">
            {PERIODS.map((p) => (
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
            Refresh
          </button>
        </div>
      </div>

      {loading ? <div className="alert alert-info py-2">Loading statistics...</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => load(period)}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {summary ? (
        <div className="row g-3">
          {/* Completion rates overview */}
          <div className="col-12">
            <div className="card">
              <div className="card-header fw-semibold py-2">
                Completion rates · {summary.start_date} → {summary.end_date}
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-sm-3">
                    <div className="text-center p-2">
                      <div className="fs-4 fw-bold text-primary">{pct(summary.chores.completion_rate)}</div>
                      <div className="small text-muted mt-1">Chores</div>
                      <div className="small text-muted">
                        {summary.chores.total_completed}/{summary.chores.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="text-center p-2">
                      <div className="fs-4 fw-bold text-success">{pct(summary.routines.completion_rate)}</div>
                      <div className="small text-muted mt-1">Routines</div>
                      <div className="small text-muted">
                        {summary.routines.total_completed}/{summary.routines.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="text-center p-2">
                      <div className="fs-4 fw-bold text-info">{pct(summary.medications.adherence_rate)}</div>
                      <div className="small text-muted mt-1">Medication</div>
                      <div className="small text-muted">
                        {summary.medications.total_taken}/{summary.medications.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="text-center p-2">
                      <div className="fs-4 fw-bold text-warning">{pct(summary.planned_items.completion_rate)}</div>
                      <div className="small text-muted mt-1">Planned items</div>
                      <div className="small text-muted">
                        {summary.planned_items.total_completed}/{summary.planned_items.total_scheduled}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Streak leaderboard */}
          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header fw-semibold py-2">🔥 Streak leaderboard</div>
              <ul className="list-group list-group-flush">
                {summary.chores.streaks.length === 0 && summary.routines.streaks.length === 0 ? (
                  <li className="list-group-item py-2 text-muted">No active streaks.</li>
                ) : (
                  [
                    ...summary.chores.streaks.map((s) => ({
                      key: `chore-${s.chore_id}`,
                      name: s.name,
                      current: s.current_streak,
                      best: s.longest_streak,
                      type: "Chore",
                    })),
                    ...summary.routines.streaks.map((s) => ({
                      key: `routine-${s.routine_id}`,
                      name: s.name,
                      current: s.current_streak,
                      best: s.longest_streak,
                      type: "Routine",
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
                            <small className="text-muted d-block">Best: {item.best}</small>
                          </div>
                        </div>
                      </li>
                    ))
                )}
              </ul>
            </div>
          </div>

          {/* Most-skipped chores */}
          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header fw-semibold py-2">Most-skipped chores</div>
              <ul className="list-group list-group-flush">
                {summary.chores.most_skipped.length === 0 ? (
                  <li className="list-group-item py-2 text-muted">No skipped chores.</li>
                ) : (
                  summary.chores.most_skipped.map((item) => (
                    <li key={item.chore_id} className="list-group-item py-2">
                      <div className="d-flex justify-content-between align-items-center gap-2">
                        <div className="fw-semibold">{item.name}</div>
                        <span className="badge text-bg-secondary">{item.skip_count} skip{item.skip_count === 1 ? "" : "s"}</span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          {/* Daily completions - chores */}
          {summary.chores.daily_completions.length > 0 ? (
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header fw-semibold py-2">Chores — daily completion rate</div>
                <div className="card-body pb-2">
                  <CompletionChart entries={summary.chores.daily_completions} color="#0d6efd" />
                </div>
              </div>
            </div>
          ) : null}

          {/* Daily completions - routines */}
          {summary.routines.daily_completions.length > 0 ? (
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header fw-semibold py-2">Routines — daily completion rate</div>
                <div className="card-body pb-2">
                  <CompletionChart entries={summary.routines.daily_completions} color="#198754" />
                </div>
              </div>
            </div>
          ) : null}

          {/* Medication adherence */}
          {summary.medications.daily_adherence.length > 0 ? (
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header fw-semibold py-2">Medication adherence</div>
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

function CompletionChart({ entries, color }: { entries: DailyCount[]; color: string }) {
  const fill = color + "33";
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
          formatter={(v: unknown) => [`${Math.round((v as number) * 100)}%`, "Completion"]}
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
          fill={fill}
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
          formatter={(v: unknown) => [`${Math.round((v as number) * 100)}%`, "Adherence"]}
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
          stroke="#0dcaf0"
          fill="#0dcaf033"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
