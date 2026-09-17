import { useMemo, useState } from "react";
import { areaY, defineChart } from "@tanstack/charts";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { curveMonotoneX } from "d3-shape";
import * as m from "@/paraglide/messages";
import {
  type AnalyticsPeriod,
  type DailyCount,
} from "@/lib/api/analytics";
import { isRetryableApiError } from "@/lib/api/http";
import { useStatsSummaryQuery } from "@/features/stats/useStatsQuery";

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

function toCompletionTrend(entries: readonly DailyCount[]): TrendPoint[] {
  return entries.map((e) => ({ date: e.date, value: e.completion_rate }));
}

function toAdherenceTrend(entries: readonly AdherenceEntry[]): TrendPoint[] {
  return entries.map((e) => ({ date: e.date, value: e.adherence_rate }));
}

export function StatsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("week");
  const summaryQuery = useStatsSummaryQuery(period);
  const summary = summaryQuery.data ?? null;
  const loading = summaryQuery.isPending;
  const error = summaryQuery.error instanceof Error
    ? summaryQuery.error.message
    : summaryQuery.error
      ? "Unable to load analytics."
      : null;
  const canRetry = summaryQuery.error ? isRetryableApiError(summaryQuery.error) : false;

  const periods: { value: AnalyticsPeriod; label: string }[] = [
    { value: "week", label: m.stats_period_week() },
    { value: "month", label: m.stats_period_month() },
    { value: "quarter", label: m.stats_period_quarter() },
    { value: "year", label: m.stats_period_year() },
  ];

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
            onClick={() => void summaryQuery.refetch()}
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
              onClick={() => void summaryQuery.refetch()}
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
                  <TrendAreaChart
                    rows={toCompletionTrend(summary.chores.daily_completions)}
                    stroke="var(--bs-primary)"
                    fill="rgba(var(--bs-primary-rgb), 0.2)"
                    ariaLabel={m.stats_chores_daily_header()}
                    tooltipLabel={m.stats_completion_tooltip()}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {summary.routines.daily_completions.length > 0 ? (
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header fw-semibold py-2">{m.stats_routines_daily_header()}</div>
                <div className="card-body pb-2">
                  <TrendAreaChart
                    rows={toCompletionTrend(summary.routines.daily_completions)}
                    stroke="var(--bs-success)"
                    fill="rgba(var(--bs-success-rgb), 0.2)"
                    ariaLabel={m.stats_routines_daily_header()}
                    tooltipLabel={m.stats_completion_tooltip()}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {summary.medications.daily_adherence.length > 0 ? (
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header fw-semibold py-2">{m.stats_medication_adherence_header()}</div>
                <div className="card-body pb-2">
                  <TrendAreaChart
                    rows={toAdherenceTrend(summary.medications.daily_adherence)}
                    stroke="var(--bs-info)"
                    fill="rgba(var(--bs-info-rgb), 0.2)"
                    ariaLabel={m.stats_medication_adherence_header()}
                    tooltipLabel={m.stats_adherence_tooltip()}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

interface TrendPoint {
  date: string;
  value: number;
}

interface TrendAreaChartProps {
  rows: readonly TrendPoint[];
  stroke: string;
  fill: string;
  ariaLabel: string;
  tooltipLabel: string;
}

function TrendAreaChart({ rows, stroke, fill, ariaLabel, tooltipLabel }: TrendAreaChartProps) {
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          areaY(rows, {
            x: "date",
            y: "value",
            curve: d3Curve(curveMonotoneX),
            stroke,
            strokeWidth: 2,
            fill,
            fillOpacity: 1,
          }),
        ],
        scales: {
          x: {
            scale: () => scalePoint<string>().padding(0.05),
            axis: {
              line: false,
              ticks: { format: (value: string) => shortDate(value) },
            },
          },
          y: {
            scale: scaleLinear().domain([0, 1]),
            grid: true,
            axis: {
              ticks: { format: (value: number) => `${Math.round(value * 100)}%` },
            },
          },
        },
        tooltip: {
          use: tooltip,
          items: [
            {
              channel: "y",
              label: tooltipLabel,
              text: (point: { yValue?: unknown }) =>
                `${Math.round(Number(point.yValue ?? 0) * 100)}%`,
            },
          ],
        },
      }),
    [rows, stroke, fill, tooltipLabel],
  );

  return <Chart definition={definition} height={140} ariaLabel={ariaLabel} />;
}
