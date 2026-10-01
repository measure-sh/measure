"use client";

import { type LineCustomCanvasLayer, ResponsiveLineCanvas } from "@nivo/line";
import { DateTime } from "luxon";
import React, { useCallback, useMemo } from "react";
import {
  CHART_GRID_DOT_SIZE,
  CHART_TEXT_SIZE,
  CHART_TICK_PADDING,
  CHART_TICK_SIZE,
  CHART_VALUE_TICK_COUNT,
  chartAxisMargin,
  COUNT_TICK_LABEL_WIDTH,
  gridDotPositions,
  useChartCanvasTheme,
  useChartGridOpacity,
  useChartColors,
} from "../utils/chart_utils";
import {
  formatMillisToHumanReadable,
  formatPlotTooltipDate,
  getPlotTimeGroupNivoConfig,
  type PlotTimeGroup,
} from "../utils/time_utils";
import { PlotTooltipShell, PlotTooltipSwatch } from "./plot_tooltip";
import { Separator } from "./separator";

// A value with no value on either side has no line segment to show it, so it
// is drawn as a point of this size. Other values draw a point only while
// hovered, since a point at every date crowds the lines.
const ISOLATED_POINT_SIZE = 6;
const HOVER_POINT_SIZE = 6;
const LINE_WIDTH = 2;
const CROSSHAIR_WIDTH = 1;
const CROSSHAIR_DASH = [4, 4];
const DIMMED_OPACITY = 0.15;
const X_TICK_COUNT = 6;
// Fits a duration label like "1m 20s".
export const DURATION_TICK_LABEL_WIDTH = 38;

// Ticks on an axis that spans only a few milliseconds fall between whole
// milliseconds, so durations below a second keep up to two decimals.
export function formatDurationTick(millis: number) {
  return millis < 1000
    ? `${Number(millis.toFixed(2))}ms`
    : formatMillisToHumanReadable(millis);
}

// Fits the widest date tick label, "Oct 2026".
const DATE_TICK_LABEL_WIDTH = 45;

// A date label rotated by this many degrees reaches below the axis by its
// width and height projected onto the vertical.
function dateTickLabelHeight(rotation: number) {
  const radians = (Math.abs(rotation) * Math.PI) / 180;
  return Math.ceil(
    DATE_TICK_LABEL_WIDTH * Math.sin(radians) +
      CHART_TEXT_SIZE * Math.cos(radians),
  );
}

// Ticks fall on round times, so each label shows only what changes at its
// tick: the month for month-grouped ranges, otherwise the date at midnight and
// the time within a day.
function formatTimeTick(value: Date, plotTimeGroup: PlotTimeGroup) {
  const date = DateTime.fromJSDate(value);
  if (plotTimeGroup === "months") {
    return date.toFormat("MMM yyyy");
  }
  if (date.hour === 0 && date.minute === 0) {
    return date.toFormat("MMM dd");
  }
  return date.toFormat("HH:mm");
}

function parseRangeDate(value: string | undefined) {
  const date = new Date(value ?? "");
  return Number.isNaN(date.getTime()) ? "auto" : date;
}

// The custom layer receives nivo's d3 scales, which are typed only as
// functions; the grid needs their ticks to line up with the axis ticks.
type ScaleWithTicks = {
  (value: unknown): number;
  ticks: (count: number) => unknown[];
};

export function formatCount(count: number, singular: string, plural: string) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

export function formatCountWithShare(count: number, total: number) {
  const share = total > 0 ? (count / total) * 100 : 0;
  const percent = share > 0 && share < 0.1 ? "<0.1" : share.toFixed(1);
  return `${count.toLocaleString()} (${percent}%)`;
}

export type TimeSeries = {
  id: string;
  data: readonly { x: string; y: number | null }[];
};

type SeriesValue<Series extends TimeSeries> = {
  seriesId: string;
  color: string;
  datum: Series["data"][number];
};

interface TimeSeriesPlotProps<Series extends TimeSeries> {
  data: readonly Series[];
  plotTimeGroup: PlotTimeGroup;
  // The selected range. Without it the x axis spans the data.
  startDate?: string;
  endDate?: string;
  xAxisTitle?: string;
  yAxisTitle?: string;
  formatTick: (value: number) => string;
  // Counts have no fractional values, so their fractional ticks are dropped.
  integerTicks?: boolean;
  tickLabelWidth?: number;
  showGrid?: boolean;
  xTickRotation?: number;
  colors?: (seriesId: string) => string;
  // Lists every series at the hovered date in the tooltip, for charts where
  // some series are too small next to the others to hover.
  showAllSeriesInTooltip?: boolean;
  formatTooltip: (
    seriesId: string,
    datum: Series["data"][number],
  ) => React.ReactNode;
  // Shown under the series in the tooltip, for charts whose values are parts
  // of a total.
  tooltipTotal?: (datum: Series["data"][number]) => number;
}

export default function TimeSeriesPlot<Series extends TimeSeries>({
  data,
  plotTimeGroup,
  startDate,
  endDate,
  xAxisTitle,
  yAxisTitle,
  formatTick,
  integerTicks = false,
  tickLabelWidth = COUNT_TICK_LABEL_WIDTH,
  showGrid = true,
  xTickRotation = 0,
  colors,
  showAllSeriesInTooltip = false,
  formatTooltip,
  tooltipTotal,
}: TimeSeriesPlotProps<Series>) {
  const chartColors = useChartColors();
  const canvasTheme = useChartCanvasTheme();
  const gridOpacity = useChartGridOpacity();
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup);
  const bottomMargin = chartAxisMargin(
    dateTickLabelHeight(xTickRotation),
    Boolean(Boolean(xAxisTitle)),
  );
  const leftMargin = chartAxisMargin(tickLabelWidth, Boolean(yAxisTitle));

  // Below a peak of CHART_VALUE_TICK_COUNT, d3 steps the y axis in fractions,
  // which counts can't have, so count charts get a tick on every whole number.
  const wholeNumberTicks = useMemo(() => {
    if (!integerTicks) {
      return undefined;
    }
    const peak = data.reduce(
      (max, s) => s.data.reduce((m, d) => Math.max(m, d.y ?? 0), max),
      0,
    );
    if (peak >= CHART_VALUE_TICK_COUNT) {
      return undefined;
    }
    return Array.from({ length: Math.ceil(peak) + 1 }, (_, i) => i);
  }, [data, integerTicks]);

  // nivo's canvas tooltip receives only the point under the cursor, so each
  // value carries the values of every series at its date for the tooltip to
  // list them.
  const plotData = useMemo(() => {
    if (!showAllSeriesInTooltip) {
      return data;
    }
    const valuesByDate = new Map<string, SeriesValue<Series>[]>();
    data.forEach((s, index) => {
      const color = colors
        ? colors(s.id)
        : chartColors[index % chartColors.length];
      for (const datum of s.data) {
        if (datum.y === null) {
          continue;
        }
        const values = valuesByDate.get(datum.x) ?? [];
        values.push({ seriesId: s.id, color, datum });
        valuesByDate.set(datum.x, values);
      }
    });
    return data.map((s) => ({
      ...s,
      data: s.data.map((datum) => ({
        ...datum,
        seriesAtDate: valuesByDate.get(datum.x) ?? [],
      })),
    }));
  }, [data, showAllSeriesInTooltip, colors, chartColors]);

  // nivo's line and point layers draw each series in one fixed color, so this
  // layer draws them itself to fade every series except the one under the
  // cursor, which nivo passes in as currentPoint. It also draws the grid and
  // the crosshair, because nivo's canvas grid can only draw lines and its
  // canvas chart has no crosshair.
  const drawSeries = useCallback<LineCustomCanvasLayer<Series>>(
    (
      ctx,
      {
        series,
        lineGenerator,
        currentPoint,
        xScale,
        yScale,
        innerWidth,
        innerHeight,
      },
    ) => {
      const activeSeries = currentPoint?.seriesId ?? null;
      const opacityFor = (seriesId: string) =>
        activeSeries === null || seriesId === activeSeries ? 1 : DIMMED_OPACITY;

      ctx.save();
      if (showGrid) {
        const x = xScale as ScaleWithTicks;
        const y = yScale as ScaleWithTicks;
        const yTicks = (
          wholeNumberTicks ?? y.ticks(CHART_VALUE_TICK_COUNT)
        ).filter((tick) => !integerTicks || Number.isInteger(tick));
        const xs = gridDotPositions(x.ticks(X_TICK_COUNT).map(x), innerWidth);
        const ys = gridDotPositions(yTicks.map(y), innerHeight);
        ctx.fillStyle = canvasTheme.axis.ticks.text.fill;
        ctx.globalAlpha = gridOpacity;
        ctx.beginPath();
        for (const dotX of xs) {
          for (const dotY of ys) {
            ctx.moveTo(dotX + CHART_GRID_DOT_SIZE / 2, dotY);
            ctx.arc(dotX, dotY, CHART_GRID_DOT_SIZE / 2, 0, 2 * Math.PI);
          }
        }
        ctx.fill();
      }

      lineGenerator.context(ctx);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (const s of series) {
        ctx.globalAlpha = opacityFor(s.id);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = LINE_WIDTH;
        ctx.beginPath();
        lineGenerator(s.data.map((d) => d.position));
        ctx.stroke();
      }

      for (const s of series) {
        ctx.globalAlpha = opacityFor(s.id);
        ctx.fillStyle = s.color;
        s.data.forEach((d, index) => {
          const isolated =
            d.data.y !== null &&
            (s.data[index - 1]?.data.y ?? null) === null &&
            (s.data[index + 1]?.data.y ?? null) === null;
          if (!isolated) {
            return;
          }
          ctx.beginPath();
          ctx.arc(
            d.position.x,
            d.position.y,
            ISOLATED_POINT_SIZE / 2,
            0,
            2 * Math.PI,
          );
          ctx.fill();
        });
      }

      if (currentPoint) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = currentPoint.seriesColor;
        ctx.lineWidth = CROSSHAIR_WIDTH;
        ctx.setLineDash(CROSSHAIR_DASH);
        ctx.beginPath();
        ctx.moveTo(currentPoint.x, 0);
        ctx.lineTo(currentPoint.x, innerHeight);
        ctx.moveTo(0, currentPoint.y);
        ctx.lineTo(innerWidth, currentPoint.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = currentPoint.seriesColor;
        ctx.beginPath();
        ctx.arc(
          currentPoint.x,
          currentPoint.y,
          HOVER_POINT_SIZE / 2,
          0,
          2 * Math.PI,
        );
        ctx.fill();
      }
      ctx.restore();
    },
    [canvasTheme, gridOpacity, integerTicks, showGrid, wholeNumberTicks],
  );

  return (
    <ResponsiveLineCanvas
      data={plotData as readonly Series[]}
      curve="linear"
      theme={canvasTheme}
      colors={colors ? ({ id }) => colors(id) : chartColors}
      layers={["axes", drawSeries, "mesh"]}
      margin={{ top: 16, right: 24, bottom: bottomMargin, left: leftMargin }}
      xFormat={timeConfig.xFormat}
      xScale={{
        format: timeConfig.xScaleFormat,
        precision: timeConfig.xScalePrecision,
        type: "time",
        useUTC: false,
        min: parseRangeDate(startDate),
        max: parseRangeDate(endDate),
      }}
      yScale={{
        type: "linear",
        min: 0,
        max: "auto",
        nice: true,
      }}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: CHART_TICK_SIZE,
        tickPadding: CHART_TICK_PADDING,
        tickRotation: xTickRotation,
        format: (value) => formatTimeTick(value, plotTimeGroup),
        tickValues: X_TICK_COUNT,
        legend: xAxisTitle,
        legendOffset: bottomMargin - CHART_TEXT_SIZE / 2,
        legendPosition: "middle",
      }}
      axisLeft={{
        tickSize: CHART_TICK_SIZE,
        tickPadding: CHART_TICK_PADDING,
        tickValues: wholeNumberTicks ?? CHART_VALUE_TICK_COUNT,
        format: (value) =>
          integerTicks && !Number.isInteger(value) ? "" : formatTick(value),
        legend: yAxisTitle,
        legendOffset: -(leftMargin - CHART_TEXT_SIZE / 2),
        legendPosition: "middle",
      }}
      enableGridX={false}
      enableGridY={false}
      tooltip={({ point }) => {
        const values: SeriesValue<Series>[] = showAllSeriesInTooltip
          ? (point.data as unknown as { seriesAtDate: SeriesValue<Series>[] })
              .seriesAtDate
          : [
              {
                seriesId: point.seriesId,
                color: point.seriesColor,
                datum: point.data,
              },
            ];
        return (
          <PlotTooltipShell>
            <div className="py-1">
              {values.map((value) => (
                <div
                  className={`flex flex-row items-center px-4 py-2 ${value.seriesId === point.seriesId ? "" : "opacity-20"}`}
                  key={value.seriesId}
                >
                  <PlotTooltipSwatch color={value.color} />
                  <span className="px-2">
                    {formatTooltip(value.seriesId, value.datum)}
                  </span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="px-4 py-3">
              {tooltipTotal && (
                <p className="pb-2">
                  Total: {tooltipTotal(point.data).toLocaleString()}
                </p>
              )}
              <p>
                Date:{" "}
                {formatPlotTooltipDate(point.data.xFormatted, plotTimeGroup)}
              </p>
            </div>
          </PlotTooltipShell>
        );
      }}
    />
  );
}
