"use client";

import { type LineCustomCanvasLayer, ResponsiveLineCanvas } from "@nivo/line";
import { ChartLine } from "lucide-react";
import { DateTime } from "luxon";
import { type MouseEvent, useCallback, useMemo, useRef, useState } from "react";
import type { FunnelTrend, FunnelTrendPeriod } from "../../api/api_calls";
import {
  CHART_DATE_TICK_COUNT,
  CHART_GRID_DOT_SIZE,
  CHART_TEXT_SIZE,
  CHART_TICK_PADDING,
  CHART_TICK_SIZE,
  CHART_VALUE_TICK_COUNT,
  chartAxisMargin,
  dateTickLabelHeight,
  drawIsolatedPoints,
  gridDotPositions,
  useChartCanvasTheme,
  useChartGridOpacity,
} from "../../utils/chart_utils";
import { useStepColor } from "./step_color";
import { numberToKMB } from "../../utils/number_utils";
import { formatMillisToHumanReadable } from "../../utils/time_utils";
import DropdownSelect, { DropdownSelectType } from "../dropdown_select";
import EmptyState from "../empty_state";
import { PlotTooltipShell, PlotTooltipSwatch } from "../plot_tooltip";
import { Separator } from "../separator";
import { SkeletonPlot } from "../skeleton";
import {
  DURATION_TICK_LABEL_WIDTH,
  formatDurationTick,
} from "../time_series_plot";

export enum FunnelTrendMetric {
  Conversion = "Conversion",
  Time = "Time to convert",
}

const OVERALL_SERIES = "overall";
const X_TICK_ROTATION = 60;
const LINE_WIDTH = 2;
const HOVER_POINT_SIZE = 6;
const DIMMED_OPACITY = 0.15;
const DASH = [4, 4];
const BAR_WIDTH_SHARE = 0.6;
const BAR_OPACITY = 0.35;
const SHADE_OPACITY = 0.06;
const HIGHLIGHT_OPACITY = 0.1;
const MARKER_OPACITY = 0.6;
const ENTERED_TICK_COUNT = 3;
// Build labels are drawn above the plot. A label that would overlap the
// label to its left is drawn one row higher, and the top margin leaves room
// for this many rows.
const BUILD_LABEL_ROWS = 2;
const BUILD_LABEL_ROW_HEIGHT = 14;
const BUILD_LABEL_GAP = 6;
const BUILD_LABEL_MAX_WIDTH = 160;
export const TOP_MARGIN = 10 + BUILD_LABEL_ROWS * BUILD_LABEL_ROW_HEIGHT;
const RIGHT_MARGIN = 24;
const ENTERED_TOP_MARGIN = 8;
// The conversion plot has no x axis of its own, since the users plot under
// it shows the dates for both.
const CONVERSION_BOTTOM_MARGIN = 8;

type TrendDatum = {
  x: Date;
  y: number | null;
  // Index of the point in the trend, for the tooltip and clicks.
  index: number;
};

type TrendSeries = {
  id: string;
  data: TrendDatum[];
};

type SeriesSpec = {
  id: string;
  // The step users move into, or null for the whole funnel.
  step: number | null;
  label: string;
  color: string;
};

// The custom layers receive nivo's d3 scales, which are typed only as
// functions; the grid needs their ticks to line up with the axis ticks.
type ScaleWithTicks = {
  (value: unknown): number;
  ticks: (count: number) => unknown[];
};

function valueOf(
  point: FunnelTrend["points"][number],
  step: number | null,
  metric: FunnelTrendMetric,
): number | null {
  const { steps } = point;
  if (metric === FunnelTrendMetric.Time) {
    const seconds =
      step === null
        ? point.median_seconds_to_convert
        : steps[step].median_seconds_from_previous;
    return seconds === null ? null : seconds * 1000;
  }
  const from = step === null ? steps[0] : steps[step - 1];
  const to = step === null ? steps[steps.length - 1] : steps[step];
  return from.users === 0
    ? null
    : Number(((to.users / from.users) * 100).toFixed(1));
}

function formatValue(value: number, metric: FunnelTrendMetric): string {
  return metric === FunnelTrendMetric.Time
    ? formatMillisToHumanReadable(value)
    : `${value}%`;
}

function formatPeriod(datetime: string, period: FunnelTrendPeriod): string {
  const date = DateTime.fromISO(datetime);
  switch (period) {
    case "day":
      return date.toFormat("d MMM, yyyy");
    case "week":
      return `Week of ${date.toFormat("d MMM, yyyy")}`;
    case "month":
      return date.toFormat("MMM yyyy");
  }
}

type TrendBuild = FunnelTrend["builds"][number];

function buildKey(build: TrendBuild): string {
  return `${build.version_name}:${build.version_code}:${build.patch_id ?? ""}`;
}

// Patches are uploaded without an app version. A patch version is free-form
// text the developer chooses, so the patch id goes beside it to tell patches
// with the same patch version apart.
function buildText(build: TrendBuild): string {
  if (build.patch_id === null) {
    return `${build.version_name} (${build.version_code})`;
  }
  return build.patch_version === null
    ? build.patch_id
    : `${build.patch_version} (${build.patch_id})`;
}

// A label shows the full text when it fits, and otherwise the version name or
// patch version alone. Text that still does not fit is cut short with an
// ellipsis.
function buildLabel(
  ctx: CanvasRenderingContext2D,
  build: TrendBuild,
  maxWidth: number,
): string {
  const name =
    build.patch_id === null ? build.version_name : build.patch_version;
  const texts = [buildText(build), name].filter((text) => text !== null);
  const fits = (text: string) => ctx.measureText(text).width <= maxWidth;
  const fitting = texts.find(fits);
  if (fitting !== undefined) {
    return fitting;
  }
  const shortest = texts[texts.length - 1];
  for (let end = shortest.length - 1; end > 0; end--) {
    const cut = `${shortest.slice(0, end)}…`;
    if (fits(cut)) {
      return cut;
    }
  }
  return "";
}

type PeriodBounds = { start: Date; middle: Date; end: Date };

// Each point is drawn at the middle of its period, so a period's bar,
// highlight and builds all fall between its start and end on the x axis.
function periodBounds(
  points: FunnelTrend["points"],
  period: FunnelTrendPeriod,
): PeriodBounds[] {
  return points.map((point) => {
    const start = DateTime.fromISO(point.datetime);
    const end = start.plus({ [period]: 1 });
    return {
      start: start.toJSDate(),
      middle: new Date((start.toMillis() + end.toMillis()) / 2),
      end: end.toJSDate(),
    };
  });
}

// `step` is the step of the hovered line, or null for the overall line and
// the users plot.
function PeriodDetails({
  trend,
  builds,
  period,
  index,
  step,
}: {
  trend: FunnelTrend;
  builds: TrendBuild[];
  period: FunnelTrendPeriod;
  index: number;
  step: number | null;
}) {
  const point = trend.points[index];
  const start = DateTime.fromISO(point.datetime);
  const end = start.plus({ [period]: 1 });
  const uploaded = builds.filter((build) => {
    const at = DateTime.fromISO(build.uploaded_at);
    return at >= start && at < end;
  });
  return (
    <div className="px-4 py-3 flex flex-col gap-2">
      <p>Users entered (overall): {numberToKMB(point.steps[0].users)}</p>
      {step !== null && (
        <p>Users entered (step): {numberToKMB(point.steps[step - 1].users)}</p>
      )}
      <p>
        Date: {formatPeriod(point.datetime, period)}
        {point.complete ? "" : " · Still converting"}
      </p>
      {uploaded.map((build) => (
        <p
          key={buildKey(build)}
          className="max-w-80 whitespace-normal break-all"
        >
          {build.patch_id === null ? "Build uploaded" : "Patch uploaded"}:{" "}
          {buildText(build)}
        </p>
      ))}
      <p className="text-muted-foreground">Click to open in Breakdown view</p>
    </div>
  );
}

// The legend has the plots' side margins, so it is centered under the plot
// area like the x axis title above it.
function TrendLegend({
  leftMargin,
  stillConverting,
  hasBuilds,
}: {
  leftMargin: number;
  stillConverting: boolean;
  hasBuilds: boolean;
}) {
  if (!stillConverting && !hasBuilds) {
    return null;
  }
  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-2 justify-center pt-4 select-none"
      style={{ paddingLeft: leftMargin, paddingRight: RIGHT_MARGIN }}
    >
      {hasBuilds && (
        <span className="flex items-center gap-2 text-xs font-body text-muted-foreground">
          <span className="h-3 border-l border-dashed border-muted-foreground" />
          Build uploaded
        </span>
      )}
      {stillConverting && (
        <span className="flex items-center gap-2 text-xs font-body text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-foreground/10" />
          Still converting
        </span>
      )}
    </div>
  );
}

interface FunnelTrendPlotProps {
  period: FunnelTrendPeriod;
  metric: FunnelTrendMetric;
  status: "pending" | "error" | "success";
  trend: FunnelTrend | undefined;
  // Called with the start of the clicked period and the clicked line's step,
  // which is null for the Overall line.
  onSelectPoint: (datetime: string, step: number | null) => void;
}

export default function FunnelTrendPlot({
  period,
  metric,
  status,
  trend,
  onSelectPoint,
}: FunnelTrendPlotProps) {
  const empty =
    trend !== undefined && trend.points.every((p) => p.steps[0].users === 0);
  // The selections live here because the charts unmount while a new period or
  // filter loads. We keep a build unselected if a new trend also has the build.
  // If user switches date range and gets a trend without the unselected build,
  // we discard it. Then, if another switch causes it to come back, it's as if
  // it's a fresh load and it would be selected again as all builds are by
  // default.
  const [unselectedSeriesIds, setUnselectedSeriesIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [unselectedBuildKeys, setUnselectedBuildKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [previousTrend, setPreviousTrend] = useState(trend);
  if (trend !== previousTrend) {
    setPreviousTrend(trend);
    if (trend !== undefined) {
      const keys = new Set(trend.builds.map(buildKey));
      setUnselectedBuildKeys(
        (current) => new Set([...current].filter((key) => keys.has(key))),
      );
    }
  }

  return (
    <div className="flex flex-col font-body items-center justify-center w-full">
      {status === "pending" && (
        <div className="flex items-center justify-center w-full h-144">
          <SkeletonPlot />
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center justify-center w-full h-144">
          <p className="text-lg font-display text-center p-4">
            Error fetching plot, please change filters or refresh page to try
            again
          </p>
        </div>
      )}
      {status === "success" && empty && (
        <EmptyState
          icon={ChartLine}
          title="No users entered this funnel"
          description="Try different filters"
          className="h-144"
        />
      )}
      {status === "success" && !empty && trend && (
        <TrendCharts
          period={period}
          metric={metric}
          trend={trend}
          unselectedSeriesIds={unselectedSeriesIds}
          onChangeUnselectedSeriesIds={setUnselectedSeriesIds}
          unselectedBuildKeys={unselectedBuildKeys}
          onChangeUnselectedBuildKeys={setUnselectedBuildKeys}
          onSelectPoint={onSelectPoint}
        />
      )}
    </div>
  );
}

function TrendCharts({
  period,
  metric,
  trend,
  unselectedSeriesIds,
  onChangeUnselectedSeriesIds,
  unselectedBuildKeys,
  onChangeUnselectedBuildKeys,
  onSelectPoint,
}: {
  period: FunnelTrendPeriod;
  metric: FunnelTrendMetric;
  trend: FunnelTrend;
  unselectedSeriesIds: Set<string>;
  onChangeUnselectedSeriesIds: (unselectedSeriesIds: Set<string>) => void;
  unselectedBuildKeys: Set<string>;
  onChangeUnselectedBuildKeys: (unselectedBuildKeys: Set<string>) => void;
  onSelectPoint: (datetime: string, step: number | null) => void;
}) {
  const canvasTheme = useChartCanvasTheme();
  const gridOpacity = useChartGridOpacity();
  const colorOf = useStepColor();
  const foreground = canvasTheme.text.fill;
  const muted = canvasTheme.axis.ticks.text.fill;
  // The period under the cursor in either plot, found from the cursor's x
  // position so the highlight, tooltip and click agree on one period. nivo
  // picks the hovered point by distance, which can be a point of the next
  // period when the cursor is far above or below the lines. The ref gives the
  // tooltip the period of the current mouse move, since nivo creates the
  // tooltip before the state update renders.
  const [hovered, setHovered] = useState<number | null>(null);
  const hoveredRef = useRef<number | null>(null);
  const periods = useMemo(
    () => periodBounds(trend.points, period),
    [trend, period],
  );
  // Each tick is drawn at the middle of a period and labelled with the
  // period's start. The ticks are spaced back from the latest period, which
  // always gets a tick.
  const xTicks = useMemo(() => {
    const step = Math.ceil(periods.length / CHART_DATE_TICK_COUNT);
    return periods
      .filter((_, i) => (periods.length - 1 - i) % step === 0)
      .map((bounds) => bounds.middle);
  }, [periods]);

  const eventNames = trend.event_names;
  const specs = useMemo<SeriesSpec[]>(
    () => [
      {
        id: OVERALL_SERIES,
        step: null,
        label: "Overall",
        color: foreground,
      },
      ...eventNames.slice(1).map((name, i) => ({
        id: `step:${i + 1}`,
        step: i + 1,
        label: `${eventNames[i]} → ${name}`,
        color: colorOf(i + 1),
      })),
    ],
    [eventNames, colorOf, foreground],
  );
  const specById = useMemo(
    () => new Map(specs.map((spec) => [spec.id, spec])),
    [specs],
  );

  const series = useMemo<TrendSeries[]>(
    () =>
      specs
        .filter((spec) => !unselectedSeriesIds.has(spec.id))
        .map((spec) => ({
          id: spec.id,
          data: trend.points.map((point, index) => ({
            x: periods[index].middle,
            y: valueOf(point, spec.step, metric),
            index,
          })),
        })),
    [specs, unselectedSeriesIds, trend, periods, metric],
  );

  const entered = useMemo<TrendSeries[]>(
    () => [
      {
        id: "entered",
        data: trend.points.map((point, index) => ({
          x: periods[index].middle,
          y: point.steps[0].users,
          index,
        })),
      },
    ],
    [trend, periods],
  );

  const firstIncomplete = trend.points.findIndex((p) => !p.complete);
  const leftMargin = chartAxisMargin(DURATION_TICK_LABEL_WIDTH, true);
  const enteredBottomMargin = chartAxisMargin(
    dateTickLabelHeight(X_TICK_ROTATION),
    true,
  );
  const xScale = {
    type: "time" as const,
    format: "native" as const,
    useUTC: false,
    min: periods[0].start,
    max: periods[periods.length - 1].end,
  };

  // Only the plot area counts, where nivo shows its tooltip.
  const trackHover = (
    event: MouseEvent<HTMLDivElement>,
    top: number,
    bottom: number,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const innerWidth = rect.width - leftMargin - RIGHT_MARGIN;
    const share = (event.clientX - rect.left - leftMargin) / innerWidth;
    const min = periods[0].start.getTime();
    const max = periods[periods.length - 1].end.getTime();
    const time = min + share * (max - min);
    const index = periods.findIndex(
      (bounds) => time >= bounds.start.getTime() && time < bounds.end.getTime(),
    );
    const next =
      index === -1 || y < top || y > rect.height - bottom ? null : index;
    hoveredRef.current = next;
    if (next !== hovered) {
      setHovered(next);
    }
  };

  const clearHover = () => {
    hoveredRef.current = null;
    setHovered(null);
  };

  const formatXTick = (value: Date) => {
    const bounds = periods.find((b) => b.middle.getTime() === value.getTime());
    return bounds
      ? DateTime.fromJSDate(bounds.start).toFormat(
          period === "month" ? "MMM yyyy" : "MMM dd",
        )
      : "";
  };

  const visible = useMemo(
    () =>
      specs
        .filter((spec) => !unselectedSeriesIds.has(spec.id))
        .map((spec) => spec.id),
    [specs, unselectedSeriesIds],
  );

  const showOnly = (ids: string[]) =>
    onChangeUnselectedSeriesIds(
      new Set(
        specs.filter((spec) => !ids.includes(spec.id)).map((spec) => spec.id),
      ),
    );

  const builds = useMemo(
    () =>
      trend.builds.filter((build) => !unselectedBuildKeys.has(buildKey(build))),
    [trend, unselectedBuildKeys],
  );
  const visibleBuilds = useMemo(() => builds.map(buildKey), [builds]);

  const showOnlyBuilds = (keys: string[]) =>
    onChangeUnselectedBuildKeys(
      new Set(trend.builds.map(buildKey).filter((key) => !keys.includes(key))),
    );

  // The conversion plot and the users plot under it shade the same periods and
  // mark the same builds, and only the conversion plot labels the builds.
  const drawContext = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: ScaleWithTicks,
      innerWidth: number,
      innerHeight: number,
      labelled: boolean,
    ) => {
      ctx.font = `${CHART_TEXT_SIZE}px sans-serif`;
      ctx.fillStyle = foreground;
      if (firstIncomplete !== -1) {
        const start = x(periods[firstIncomplete].start);
        ctx.globalAlpha = SHADE_OPACITY;
        ctx.fillRect(start, 0, innerWidth - start, innerHeight);
      }
      if (hovered !== null) {
        const start = x(periods[hovered].start);
        ctx.globalAlpha = HIGHLIGHT_OPACITY;
        ctx.fillRect(start, 0, x(periods[hovered].end) - start, innerHeight);
      }
      ctx.strokeStyle = muted;
      ctx.lineWidth = 1;
      ctx.setLineDash(DASH);
      // The right edge of the last label drawn in each row.
      const rowEnds: number[] = Array(BUILD_LABEL_ROWS).fill(-Infinity);
      for (const build of builds) {
        const at = x(new Date(build.uploaded_at));
        if (at < 0 || at > innerWidth) {
          continue;
        }
        let top = 0;
        const label = labelled
          ? buildLabel(ctx, build, Math.min(BUILD_LABEL_MAX_WIDTH, innerWidth))
          : "";
        const width = ctx.measureText(label).width;
        const left = Math.max(0, Math.min(at - width / 2, innerWidth - width));
        // A label with no free row is left out, and the tooltip of its
        // period still specifies the build.
        const row = rowEnds.findIndex((end) => left >= end + BUILD_LABEL_GAP);
        if (label !== "" && row !== -1) {
          rowEnds[row] = left + width;
          const bottom = -6 - row * BUILD_LABEL_ROW_HEIGHT;
          top = row === 0 ? 0 : bottom + 2;
          ctx.globalAlpha = 1;
          ctx.fillStyle = muted;
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.fillText(label, left, bottom);
        }
        ctx.globalAlpha = MARKER_OPACITY;
        ctx.beginPath();
        ctx.moveTo(at, top);
        ctx.lineTo(at, innerHeight);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    },
    [builds, periods, hovered, firstIncomplete, foreground, muted],
  );

  const drawLines = useCallback<LineCustomCanvasLayer<TrendSeries>>(
    (
      ctx,
      {
        series: computed,
        lineGenerator,
        currentPoint,
        xScale: x,
        yScale: y,
        innerWidth,
        innerHeight,
      },
    ) => {
      const activeSeries = currentPoint?.seriesId ?? null;
      const opacityFor = (id: string) =>
        activeSeries === null || id === activeSeries ? 1 : DIMMED_OPACITY;

      ctx.save();
      const xs = gridDotPositions(xTicks.map(x as ScaleWithTicks), innerWidth);
      const ys = gridDotPositions(
        (y as ScaleWithTicks)
          .ticks(CHART_VALUE_TICK_COUNT)
          .map(y as ScaleWithTicks),
        innerHeight,
      );
      ctx.fillStyle = muted;
      ctx.globalAlpha = gridOpacity;
      ctx.beginPath();
      for (const dotX of xs) {
        for (const dotY of ys) {
          ctx.moveTo(dotX + CHART_GRID_DOT_SIZE / 2, dotY);
          ctx.arc(dotX, dotY, CHART_GRID_DOT_SIZE / 2, 0, 2 * Math.PI);
        }
      }
      ctx.fill();

      drawContext(ctx, x as ScaleWithTicks, innerWidth, innerHeight, true);

      // Periods whose users are still converting are drawn dashed, joined
      // to the last complete period.
      const split = firstIncomplete === -1 ? Infinity : firstIncomplete;
      lineGenerator.context(ctx);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = LINE_WIDTH;
      for (const s of computed) {
        ctx.globalAlpha = opacityFor(s.id);
        ctx.strokeStyle = s.color;
        const positions = s.data.map((d) => d.position);
        ctx.beginPath();
        lineGenerator(positions.slice(0, split));
        ctx.stroke();
        if (split < positions.length) {
          ctx.setLineDash(DASH);
          ctx.beginPath();
          lineGenerator(positions.slice(Math.max(0, split - 1)));
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = s.color;
        drawIsolatedPoints(ctx, s.data);
      }

      const hoveredDatum =
        hovered === null
          ? undefined
          : computed.find((s) => s.id === activeSeries)?.data[hovered];
      if (currentPoint && hoveredDatum && hoveredDatum.position.y !== null) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = currentPoint.seriesColor;
        ctx.beginPath();
        ctx.arc(
          hoveredDatum.position.x,
          hoveredDatum.position.y,
          HOVER_POINT_SIZE / 2,
          0,
          2 * Math.PI,
        );
        ctx.fill();
      }
      ctx.restore();
    },
    [drawContext, xTicks, hovered, firstIncomplete, gridOpacity, muted],
  );

  const drawBars = useCallback<LineCustomCanvasLayer<TrendSeries>>(
    (ctx, { series: computed, xScale: x, innerWidth, innerHeight }) => {
      const scale = x as ScaleWithTicks;
      ctx.save();
      drawContext(ctx, scale, innerWidth, innerHeight, false);
      ctx.fillStyle = foreground;
      for (const bar of computed[0]?.data ?? []) {
        if (bar.position.y === null) {
          continue;
        }
        const { start, end } = periods[bar.data.index];
        const span = scale(end) - scale(start);
        const width = span * BAR_WIDTH_SHARE;
        ctx.globalAlpha =
          hovered === bar.data.index ? BAR_OPACITY * 2 : BAR_OPACITY;
        ctx.fillRect(
          scale(start) + (span - width) / 2,
          bar.position.y,
          width,
          innerHeight - bar.position.y,
        );
      }
      ctx.restore();
    },
    [drawContext, periods, hovered, foreground],
  );

  const hoveredValue = (seriesId: string, index: number) => {
    const value = series.find((s) => s.id === seriesId)!.data[
      hoveredRef.current ?? index
    ].y;
    return value === null ? "No users" : formatValue(value, metric);
  };

  const handleClick = (seriesId: string, index: number) =>
    onSelectPoint(
      trend.points[index].datetime,
      specById.get(seriesId)?.step ?? null,
    );

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-wrap gap-2">
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Select Steps"
          items={specs.map((spec) => ({
            value: spec.id,
            label: spec.label,
            color: spec.color,
          }))}
          initialSelected={visible}
          onChangeSelected={(ids) => showOnly(ids as string[])}
        />
        {trend.builds.length > 0 && (
          <DropdownSelect
            type={DropdownSelectType.MultiString}
            title="Select Builds"
            items={trend.builds.map((build) => ({
              value: buildKey(build),
              label: buildText(build),
            }))}
            initialSelected={visibleBuilds}
            onChangeSelected={(keys) => showOnlyBuilds(keys as string[])}
          />
        )}
      </div>
      {/* Build labels are drawn in the plot's top margin, so this keeps them
          as far below the dropdowns as the cadence plot. */}
      <div style={{ height: BUILD_LABEL_ROW_HEIGHT }} />
      <div
        className="relative w-full h-96 cursor-pointer"
        onMouseMoveCapture={(event) =>
          trackHover(event, TOP_MARGIN, CONVERSION_BOTTOM_MARGIN)
        }
        onMouseLeave={clearHover}
      >
        {series.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
            No steps selected
          </p>
        )}
        <ResponsiveLineCanvas
          data={series}
          curve="linear"
          theme={canvasTheme}
          colors={({ id }) => specById.get(id)?.color ?? foreground}
          layers={["axes", drawLines, "mesh"]}
          margin={{
            top: TOP_MARGIN,
            right: RIGHT_MARGIN,
            bottom: CONVERSION_BOTTOM_MARGIN,
            left: leftMargin,
          }}
          xScale={xScale}
          yScale={{ type: "linear", min: 0, max: "auto", nice: true }}
          axisTop={null}
          axisRight={null}
          axisBottom={null}
          axisLeft={{
            tickSize: CHART_TICK_SIZE,
            tickPadding: CHART_TICK_PADDING,
            tickValues: CHART_VALUE_TICK_COUNT,
            format: (value) =>
              metric === FunnelTrendMetric.Time
                ? formatDurationTick(value)
                : `${value}%`,
            legend: metric === FunnelTrendMetric.Time ? "Median time" : metric,
            legendOffset: -(leftMargin - CHART_TEXT_SIZE / 2),
            legendPosition: "middle",
          }}
          enableGridX={false}
          enableGridY={false}
          onClick={(datum) => {
            if ("seriesId" in datum) {
              handleClick(
                datum.seriesId,
                hoveredRef.current ?? datum.data.index,
              );
            }
          }}
          tooltip={({ point }) => (
            <PlotTooltipShell>
              <div className="flex flex-row items-center px-4 py-3">
                <PlotTooltipSwatch color={point.seriesColor} />
                <span className="px-2">
                  {specById.get(point.seriesId)!.label} -{" "}
                  {hoveredValue(point.seriesId, point.data.index)}
                </span>
              </div>
              <Separator />
              <PeriodDetails
                trend={trend}
                builds={builds}
                period={period}
                index={hoveredRef.current ?? point.data.index}
                step={specById.get(point.seriesId)?.step ?? null}
              />
            </PlotTooltipShell>
          )}
        />
      </div>
      <div
        className="w-full h-44 cursor-pointer"
        onMouseMoveCapture={(event) =>
          trackHover(event, ENTERED_TOP_MARGIN, enteredBottomMargin)
        }
        onMouseLeave={clearHover}
      >
        <ResponsiveLineCanvas
          data={entered}
          curve="linear"
          theme={canvasTheme}
          colors={[foreground]}
          layers={["axes", drawBars, "mesh"]}
          margin={{
            top: ENTERED_TOP_MARGIN,
            right: RIGHT_MARGIN,
            bottom: enteredBottomMargin,
            left: leftMargin,
          }}
          xScale={xScale}
          yScale={{ type: "linear", min: 0, max: "auto", nice: true }}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: CHART_TICK_SIZE,
            tickPadding: CHART_TICK_PADDING,
            tickRotation: X_TICK_ROTATION,
            format: formatXTick,
            tickValues: xTicks,
            legend:
              period === "day" ? "Day" : period === "week" ? "Week" : "Month",
            legendOffset: enteredBottomMargin - CHART_TEXT_SIZE / 2,
            legendPosition: "middle",
          }}
          axisLeft={{
            tickSize: CHART_TICK_SIZE,
            tickPadding: CHART_TICK_PADDING,
            tickValues: ENTERED_TICK_COUNT,
            format: (value) => numberToKMB(value),
            legend: "Users",
            legendOffset: -(leftMargin - CHART_TEXT_SIZE / 2),
            legendPosition: "middle",
          }}
          enableGridX={false}
          enableGridY={false}
          onClick={(datum) => {
            if ("seriesId" in datum) {
              handleClick(
                OVERALL_SERIES,
                hoveredRef.current ?? datum.data.index,
              );
            }
          }}
          tooltip={({ point }) => (
            <PlotTooltipShell>
              <PeriodDetails
                trend={trend}
                builds={builds}
                period={period}
                index={hoveredRef.current ?? point.data.index}
                step={null}
              />
            </PlotTooltipShell>
          )}
        />
      </div>
      <TrendLegend
        leftMargin={leftMargin}
        stillConverting={firstIncomplete !== -1}
        hasBuilds={builds.length > 0}
      />
    </div>
  );
}
