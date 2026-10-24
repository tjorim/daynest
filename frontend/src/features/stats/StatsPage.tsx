import { useEffect, useMemo, useState } from "react";
import { areaY, defineChart } from "@tanstack/charts";
import { d3Curve } from "@tanstack/charts/d3/shape";
import { brushX, type BrushRange, type BrushXChange } from "@tanstack/charts/interaction/brush";
import { controlledSignal } from "@tanstack/charts/interaction/signal";
import { motion } from "@tanstack/charts/motion";
import { Chart } from "@tanstack/charts/react/core";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { curveMonotoneX } from "d3-shape";
import * as m from "@/paraglide/messages";
import { type AnalyticsPeriod, type DailyCount } from "@/lib/api/analytics";
import { isRetryableApiError } from "@/lib/api/http";
import { useStatsSummaryQuery } from "@/features/stats/useStatsQuery";
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { formatDate } from "@/lib/dateUtils";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ListGroup, ListGroupItem } from "@/components/ui/list-group";
import { Badge } from "@/components/ui/badge";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function shortDate(date: string): string {
  return formatDate(date);
}

// Spring transition for area/line redraws as data or the brush selection changes.
const chartRenderer = motion({
  transition: { type: "spring", stiffness: 170, damping: 22, mass: 1 },
});

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
  const error = summaryQuery.error
    ? apiErrorMessage(summaryQuery.error, m.load_analytics_failed())
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
      <div className="tw:flex tw:flex-col tw:md:flex-row tw:justify-between tw:items-start tw:md:items-center tw:gap-2 tw:mb-4">
        <h2 className="tw:text-h4 tw:font-medium tw:mb-0">{m.stats_title()}</h2>
        <div className="tw:flex tw:gap-2 tw:items-center tw:flex-wrap">
          <ButtonGroup aria-label={m.stats_title()}>
            {periods.map((p) => (
              <Button
                key={p.value}
                size="sm"
                variant={period === p.value ? "primary" : "outline-secondary"}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </ButtonGroup>
          <Button
            variant="outline-primary"
            size="sm"
            disabled={loading}
            onClick={() => void summaryQuery.refetch()}
          >
            {m.action_refresh()}
          </Button>
        </div>
      </div>

      {loading ? (
        <Alert variant="info" className="tw:py-2">
          {m.stats_loading()}
        </Alert>
      ) : null}
      {error ? (
        <Alert
          variant="danger"
          className="tw:py-2 tw:flex tw:justify-between tw:items-center tw:gap-2 tw:flex-wrap"
        >
          <span>{error}</span>
          {canRetry ? (
            <Button variant="danger" size="sm" onClick={() => void summaryQuery.refetch()}>
              {m.action_retry()}
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {summary ? (
        <div className="tw:grid tw:grid-cols-12 tw:gap-4">
          <div className="tw:col-span-12">
            <Card>
              <CardHeader className="tw:font-semibold tw:py-2">
                {m.stats_completion_header({ start: summary.start_date, end: summary.end_date })}
              </CardHeader>
              <CardContent>
                <div className="tw:grid tw:grid-cols-12 tw:gap-4">
                  <div className="tw:col-span-12 tw:sm:col-span-3">
                    <div className="tw:text-center tw:p-2">
                      <div className="tw:text-fluid-4 tw:font-bold tw:text-brand">
                        {pct(summary.chores.completion_rate)}
                      </div>
                      <div className="tw:text-small tw:text-muted-foreground tw:mt-1">
                        {m.stats_chores()}
                      </div>
                      <div className="tw:text-small tw:text-muted-foreground">
                        {summary.chores.total_completed}/{summary.chores.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="tw:col-span-12 tw:sm:col-span-3">
                    <div className="tw:text-center tw:p-2">
                      <div className="tw:text-fluid-4 tw:font-bold tw:text-success">
                        {pct(summary.routines.completion_rate)}
                      </div>
                      <div className="tw:text-small tw:text-muted-foreground tw:mt-1">
                        {m.stats_routines()}
                      </div>
                      <div className="tw:text-small tw:text-muted-foreground">
                        {summary.routines.total_completed}/{summary.routines.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="tw:col-span-12 tw:sm:col-span-3">
                    <div className="tw:text-center tw:p-2">
                      <div className="tw:text-fluid-4 tw:font-bold tw:text-info">
                        {pct(summary.medications.adherence_rate)}
                      </div>
                      <div className="tw:text-small tw:text-muted-foreground tw:mt-1">
                        {m.stats_medication()}
                      </div>
                      <div className="tw:text-small tw:text-muted-foreground">
                        {summary.medications.total_taken}/{summary.medications.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="tw:col-span-12 tw:sm:col-span-3">
                    <div className="tw:text-center tw:p-2">
                      <div className="tw:text-fluid-4 tw:font-bold tw:text-warning">
                        {pct(summary.planned_items.completion_rate)}
                      </div>
                      <div className="tw:text-small tw:text-muted-foreground tw:mt-1">
                        {m.stats_planned_items()}
                      </div>
                      <div className="tw:text-small tw:text-muted-foreground">
                        {summary.planned_items.total_completed}/
                        {summary.planned_items.total_scheduled}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="tw:col-span-12 tw:lg:col-span-6">
            <Card className="tw:h-full">
              <CardHeader className="tw:font-semibold tw:py-2">
                {m.stats_streak_header()}
              </CardHeader>
              <ListGroup flush render={<ul />}>
                {summary.chores.streaks.length === 0 && summary.routines.streaks.length === 0 ? (
                  <ListGroupItem render={<li />} className="tw:py-2 tw:text-muted-foreground">
                    {m.stats_no_streaks()}
                  </ListGroupItem>
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
                      <ListGroupItem render={<li />} className="tw:py-2" key={item.key}>
                        <div className="tw:flex tw:justify-between tw:items-center tw:gap-2">
                          <div>
                            <div className="tw:font-semibold">{item.name}</div>
                            <small className="tw:text-muted-foreground">{item.type}</small>
                          </div>
                          <div className="tw:text-end">
                            {item.current > 0 ? (
                              <Badge variant="warning" className="tw:me-1">
                                🔥 {item.current}
                              </Badge>
                            ) : null}
                            <small className="tw:text-muted-foreground tw:block">
                              {m.stats_best({ count: item.best })}
                            </small>
                          </div>
                        </div>
                      </ListGroupItem>
                    ))
                )}
              </ListGroup>
            </Card>
          </div>

          <div className="tw:col-span-12 tw:lg:col-span-6">
            <Card className="tw:h-full">
              <CardHeader className="tw:font-semibold tw:py-2">
                {m.stats_most_skipped_header()}
              </CardHeader>
              <ListGroup flush render={<ul />}>
                {summary.chores.most_skipped.length === 0 ? (
                  <ListGroupItem render={<li />} className="tw:py-2 tw:text-muted-foreground">
                    {m.stats_no_skipped()}
                  </ListGroupItem>
                ) : (
                  summary.chores.most_skipped.map((item) => (
                    <ListGroupItem render={<li />} className="tw:py-2" key={item.chore_id}>
                      <div className="tw:flex tw:justify-between tw:items-center tw:gap-2">
                        <div className="tw:font-semibold">{item.name}</div>
                        <Badge variant="secondary">
                          {item.skip_count === 1
                            ? m.stats_skip({ count: item.skip_count })
                            : m.stats_skips({ count: item.skip_count })}
                        </Badge>
                      </div>
                    </ListGroupItem>
                  ))
                )}
              </ListGroup>
            </Card>
          </div>

          {summary.chores.daily_completions.length > 0 ? (
            <div className="tw:col-span-12 tw:lg:col-span-6">
              <Card>
                <CardHeader className="tw:font-semibold tw:py-2">
                  {m.stats_chores_daily_header()}
                </CardHeader>
                <CardContent className="tw:pb-2">
                  <TrendAreaChart
                    rows={toCompletionTrend(summary.chores.daily_completions)}
                    stroke="var(--bs-primary)"
                    fill="rgba(var(--bs-primary-rgb), 0.2)"
                    ariaLabel={m.stats_chores_daily_header()}
                    tooltipLabel={m.stats_completion_tooltip()}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}

          {summary.routines.daily_completions.length > 0 ? (
            <div className="tw:col-span-12 tw:lg:col-span-6">
              <Card>
                <CardHeader className="tw:font-semibold tw:py-2">
                  {m.stats_routines_daily_header()}
                </CardHeader>
                <CardContent className="tw:pb-2">
                  <TrendAreaChart
                    rows={toCompletionTrend(summary.routines.daily_completions)}
                    stroke="var(--bs-success)"
                    fill="rgba(var(--bs-success-rgb), 0.2)"
                    ariaLabel={m.stats_routines_daily_header()}
                    tooltipLabel={m.stats_completion_tooltip()}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}

          {summary.medications.daily_adherence.length > 0 ? (
            <div className="tw:col-span-12 tw:lg:col-span-6">
              <Card>
                <CardHeader className="tw:font-semibold tw:py-2">
                  {m.stats_medication_adherence_header()}
                </CardHeader>
                <CardContent className="tw:pb-2">
                  <TrendAreaChart
                    rows={toAdherenceTrend(summary.medications.daily_adherence)}
                    stroke="var(--bs-info)"
                    fill="rgba(var(--bs-info-rgb), 0.2)"
                    ariaLabel={m.stats_medication_adherence_header()}
                    tooltipLabel={m.stats_adherence_tooltip()}
                  />
                </CardContent>
              </Card>
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
  const dates = useMemo(() => rows.map((r) => r.date), [rows]);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const canBrush = dates.length > 1;

  const fullRange: BrushRange<string> | null =
    firstDate !== undefined && lastDate !== undefined ? { start: firstDate, end: lastDate } : null;

  const [range, setRange] = useState<BrushRange<string> | null>(fullRange);

  // A brush selection only makes sense for the series it was drawn over — reset
  // to the full span whenever the underlying period/data changes rather than
  // silently keeping a stale sub-range selected against new data.
  useEffect(() => {
    setRange(fullRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDate, lastDate]);

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
        ...(canBrush && range
          ? {
              controls: [
                brushX({
                  range: controlledSignal<BrushRange<string>, BrushXChange<string>>(
                    range,
                    (next, { reason }) => {
                      if (reason.type === "commit") setRange(next);
                    },
                  ),
                  values: dates,
                  format: (value: string) => shortDate(value),
                  ariaLabel: m.stats_range_label({ label: ariaLabel }),
                }),
              ],
            }
          : {}),
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
    [rows, stroke, fill, tooltipLabel, canBrush, range, dates, ariaLabel],
  );

  // A brush selection narrows attention to a sub-range without re-scaling the
  // chart — surface what that sub-range actually means (its average) rather
  // than letting the drag be purely visual.
  const selection = useMemo(() => {
    if (!range) return null;
    const inRange = rows.filter((r) => r.date >= range.start && r.date <= range.end);
    if (inRange.length === 0) return null;
    const avg = inRange.reduce((sum, r) => sum + r.value, 0) / inRange.length;
    return { avg };
  }, [rows, range]);

  const isFullRange =
    range !== null &&
    fullRange !== null &&
    range.start === fullRange.start &&
    range.end === fullRange.end;

  return (
    <div>
      <Chart definition={definition} renderer={chartRenderer} height={140} ariaLabel={ariaLabel} />
      {canBrush && range && selection ? (
        <div className="tw:flex tw:justify-between tw:items-center tw:text-small tw:text-muted-foreground tw:mt-1">
          <span>
            {m.stats_trend_selection({
              start: shortDate(range.start),
              end: shortDate(range.end),
              avg: pct(selection.avg),
            })}
          </span>
          {!isFullRange ? (
            <Button variant="link" size="sm" className="tw:p-0" onClick={() => setRange(fullRange)}>
              {m.stats_trend_reset()}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
