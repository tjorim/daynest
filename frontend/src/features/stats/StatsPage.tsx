import { useEffect, useState } from "react";
import {
  fetchAnalyticsSummary,
  isRetryableApiError,
  type AnalyticsPeriod,
  type AnalyticsSummary,
} from "@/lib/api/today";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function StatsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("week");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  const load = async (p: AnalyticsPeriod, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setCanRetry(false);
    try {
      const data = await fetchAnalyticsSummary(p, signal);
      if (!signal?.aborted) {
        setSummary(data);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setCanRetry(isRetryableApiError(err));
        setError(err instanceof Error ? err.message : "Unable to load analytics.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(period, controller.signal);
    return () => controller.abort();
  }, [period]);

  const onPeriodChange = (p: AnalyticsPeriod) => {
    setPeriod(p);
  };

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-3">
        <h2 className="h4 mb-0">Statistics</h2>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <div className="btn-group btn-group-sm" role="group" aria-label="Period">
            {(["week", "month", "year"] as AnalyticsPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`btn ${period === p ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => onPeriodChange(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={loading}
            onClick={() => void load(period)}
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
              onClick={() => void load(period)}
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
                      <div className="summary-value text-primary">{pct(summary.chores.completion_rate)}</div>
                      <div className="small text-muted mt-1">Chores</div>
                      <div className="small text-muted">
                        {summary.chores.total_completed}/{summary.chores.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="text-center p-2">
                      <div className="summary-value text-success">{pct(summary.routines.completion_rate)}</div>
                      <div className="small text-muted mt-1">Routines</div>
                      <div className="small text-muted">
                        {summary.routines.total_completed}/{summary.routines.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="text-center p-2">
                      <div className="summary-value text-info">{pct(summary.medications.adherence_rate)}</div>
                      <div className="small text-muted mt-1">Medication</div>
                      <div className="small text-muted">
                        {summary.medications.total_taken}/{summary.medications.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="text-center p-2">
                      <div className="summary-value text-warning">{pct(summary.planned_items.completion_rate)}</div>
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
                <div className="card-header fw-semibold py-2">Chores — daily completions</div>
                <div className="card-body pb-2">
                  <DailyBar entries={summary.chores.daily_completions} />
                </div>
              </div>
            </div>
          ) : null}

          {/* Daily completions - routines */}
          {summary.routines.daily_completions.length > 0 ? (
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header fw-semibold py-2">Routines — daily completions</div>
                <div className="card-body pb-2">
                  <DailyBar entries={summary.routines.daily_completions} />
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
                  <AdherenceBar entries={summary.medications.daily_adherence} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DailyBar({
  entries,
}: {
  entries: { date: string; completed: number; total: number; completion_rate: number }[];
}) {
  const max = Math.max(...entries.map((e) => e.total), 1);
  return (
    <div className="d-flex align-items-end gap-1" style={{ height: "80px" }}>
      {entries.map((e) => {
        const heightPct = e.total > 0 ? (e.total / max) * 100 : 0;
        const completedPct = e.total > 0 ? (e.completed / e.total) * 100 : 0;
        return (
          <div
            key={e.date}
            className="flex-fill d-flex flex-column-reverse"
            style={{ height: "100%" }}
            title={`${e.date}: ${e.completed}/${e.total} (${Math.round(e.completion_rate * 100)}%)`}
          >
            <div
              style={{ height: `${heightPct}%`, minHeight: e.total > 0 ? "4px" : 0, position: "relative" }}
              className="rounded-top overflow-hidden"
            >
              <div
                className="bg-primary"
                style={{ height: `${completedPct}%`, position: "absolute", bottom: 0, width: "100%" }}
              />
              <div
                className="bg-primary-subtle"
                style={{ height: "100%", width: "100%" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdherenceBar({
  entries,
}: {
  entries: { date: string; taken: number; total: number; adherence_rate: number }[];
}) {
  const max = Math.max(...entries.map((e) => e.total), 1);
  return (
    <div className="d-flex align-items-end gap-1" style={{ height: "80px" }}>
      {entries.map((e) => {
        const heightPct = e.total > 0 ? (e.total / max) * 100 : 0;
        const takenPct = e.total > 0 ? (e.taken / e.total) * 100 : 0;
        return (
          <div
            key={e.date}
            className="flex-fill d-flex flex-column-reverse"
            style={{ height: "100%" }}
            title={`${e.date}: ${e.taken}/${e.total} (${Math.round(e.adherence_rate * 100)}%)`}
          >
            <div
              style={{ height: `${heightPct}%`, minHeight: e.total > 0 ? "4px" : 0, position: "relative" }}
              className="rounded-top overflow-hidden"
            >
              <div
                className="bg-info"
                style={{ height: `${takenPct}%`, position: "absolute", bottom: 0, width: "100%" }}
              />
              <div
                className="bg-info-subtle"
                style={{ height: "100%", width: "100%" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
