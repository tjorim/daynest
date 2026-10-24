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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4">
        <h2 className="text-h4 font-medium mb-0">{m.stats_title()}</h2>
        <div className="flex gap-2 items-center flex-wrap">
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
        <Alert variant="info" className="py-2">
          {m.stats_loading()}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" className="py-2 flex justify-between items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <Button variant="danger" size="sm" onClick={() => void summaryQuery.refetch()}>
              {m.action_retry()}
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {summary ? (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <Card>
              <CardHeader className="font-semibold py-2">
                {m.stats_completion_header({ start: summary.start_date, end: summary.end_date })}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 sm:col-span-3">
                    <div className="text-center p-2">
                      <div className="text-fluid-4 font-bold text-brand">
                        {pct(summary.chores.completion_rate)}
                      </div>
                      <div className="text-small text-muted-foreground mt-1">
                        {m.stats_chores()}
                      </div>
                      <div className="text-small text-muted-foreground">
                        {summary.chores.total_completed}/{summary.chores.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-12 sm:col-span-3">
                    <div className="text-center p-2">
                      <div className="text-fluid-4 font-bold text-success">
                        {pct(summary.routines.completion_rate)}
                      </div>
                      <div className="text-small text-muted-foreground mt-1">
                        {m.stats_routines()}
                      </div>
                      <div className="text-small text-muted-foreground">
                        {summary.routines.total_completed}/{summary.routines.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-12 sm:col-span-3">
                    <div className="text-center p-2">
                      <div className="text-fluid-4 font-bold text-info-emphasis">
                        {pct(summary.medications.adherence_rate)}
                      </div>
                      <div className="text-small text-muted-foreground mt-1">
                        {m.stats_medication()}
                      </div>
                      <div className="text-small text-muted-foreground">
                        {summary.medications.total_taken}/{summary.medications.total_scheduled}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-12 sm:col-span-3">
                    <div className="text-center p-2">
                      <div className="text-fluid-4 font-bold text-warning-emphasis">
                        {pct(summary.planned_items.completion_rate)}
                      </div>
                      <div className="text-small text-muted-foreground mt-1">
                        {m.stats_planned_items()}
                      </div>
                      <div className="text-small text-muted-foreground">
                        {summary.planned_items.total_completed}/
                        {summary.planned_items.total_scheduled}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <Card className="h-full">
              <CardHeader className="font-semibold py-2">{m.stats_streak_header()}</CardHeader>
              <ListGroup flush render={<ul />}>
                {summary.chores.streaks.length === 0 && summary.routines.streaks.length === 0 ? (
                  <ListGroupItem render={<li />} className="py-2 text-muted-foreground">
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
                      <ListGroupItem render={<li />} className="py-2" key={item.key}>
                        <div className="flex justify-between items-center gap-2">
                          <div>
                            <div className="font-semibold">{item.name}</div>
                            <small className="text-muted-foreground">{item.type}</small>
                          </div>
                          <div className="text-end">
                            {item.current > 0 ? (
                              <Badge variant="warning" className="me-1">
                                🔥 {item.current}
                              </Badge>
                            ) : null}
                            <small className="text-muted-foreground block">
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

          <div className="col-span-12 lg:col-span-6">
            <Card className="h-full">
              <CardHeader className="font-semibold py-2">
                {m.stats_most_skipped_header()}
              </CardHeader>
              <ListGroup flush render={<ul />}>
                {summary.chores.most_skipped.length === 0 ? (
                  <ListGroupItem render={<li />} className="py-2 text-muted-foreground">
                    {m.stats_no_skipped()}
                  </ListGroupItem>
                ) : (
                  summary.chores.most_skipped.map((item) => (
                    <ListGroupItem render={<li />} className="py-2" key={item.chore_id}>
                      <div className="flex justify-between items-center gap-2">
                        <div className="font-semibold">{item.name}</div>
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
            <div className="col-span-12 lg:col-span-6">
              <Card>
                <CardHeader className="font-semibold py-2">
                  {m.stats_chores_daily_header()}
                </CardHeader>
                <CardContent className="pb-2">
                  <TrendAreaChart
                    rows={toCompletionTrend(summary.chores.daily_completions)}
                    stroke="var(--color-brand)"
                    fill="color-mix(in srgb, var(--color-brand) 20%, transparent)"
                    ariaLabel={m.stats_chores_daily_header()}
                    tooltipLabel={m.stats_completion_tooltip()}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}

          {summary.routines.daily_completions.length > 0 ? (
            <div className="col-span-12 lg:col-span-6">
              <Card>
                <CardHeader className="font-semibold py-2">
                  {m.stats_routines_daily_header()}
                </CardHeader>
                <CardContent className="pb-2">
                  <TrendAreaChart
                    rows={toCompletionTrend(summary.routines.daily_completions)}
                    stroke="var(--color-success)"
                    fill="color-mix(in srgb, var(--color-success) 20%, transparent)"
                    ariaLabel={m.stats_routines_daily_header()}
                    tooltipLabel={m.stats_completion_tooltip()}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}

          {summary.medications.daily_adherence.length > 0 ? (
            <div className="col-span-12 lg:col-span-6">
              <Card>
                <CardHeader className="font-semibold py-2">
                  {m.stats_medication_adherence_header()}
                </CardHeader>
                <CardContent className="pb-2">
                  <TrendAreaChart
                    rows={toAdherenceTrend(summary.medications.daily_adherence)}
                    stroke="var(--color-info)"
                    fill="color-mix(in srgb, var(--color-info) 20%, transparent)"
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
        <div className="flex justify-between items-center text-small text-muted-foreground mt-1">
          <span>
            {m.stats_trend_selection({
              start: shortDate(range.start),
              end: shortDate(range.end),
              avg: pct(selection.avg),
            })}
          </span>
          {!isFullRange ? (
            <Button variant="link" size="sm" className="p-0" onClick={() => setRange(fullRange)}>
              {m.stats_trend_reset()}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
