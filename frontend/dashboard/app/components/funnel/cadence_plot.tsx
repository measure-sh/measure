"use client";

import { type LineCustomCanvasLayer, ResponsiveLineCanvas } from "@nivo/line";
import { Clock } from "lucide-react";
import { DateTime } from "luxon";
import { useCallback, useMemo, useState } from "react";
import type { FunnelCadence } from "../../api/api_calls";
import {
  CHART_GRID_DOT_SIZE,
  CHART_TEXT_SIZE,
  CHART_TICK_PADDING,
  CHART_TICK_SIZE,
  CHART_VALUE_TICK_COUNT,
  chartAxisMargin,
  drawIsolatedPoints,
  gridDotPositions,
  useChartCanvasTheme,
  useChartColors,
  useChartGridOpacity,
} from "../../utils/chart_utils";
import { numberToKMB } from "../../utils/number_utils";
import DropdownSelect, { DropdownSelectType } from "../dropdown_select";
import EmptyState from "../empty_state";
import { PlotTooltipShell, PlotTooltipSwatch } from "../plot_tooltip";
import { Separator } from "../separator";
import { SkeletonPlot } from "../skeleton";
import { formatShare } from "./format";
import { TOP_MARGIN } from "./trend_plot";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const LABELED_HOURS = HOURS.filter((hour) => hour % 3 === 0);
const LINE_WIDTH = 2;
const HOVER_POINT_SIZE = 6;
const DIMMED_OPACITY = 0.15;
const RIGHT_MARGIN = 24;
// Fits a percent tick label like "100%".
const PERCENT_TICK_LABEL_WIDTH = 30;

type HourDatum = {
  x: number;
  y: number | null;
  users: number;
  converted: number;
};

type HourSeries = {
  id: string;
  data: HourDatum[];
};

// The custom layer receives nivo's d3 scales, which are typed only as
// functions; the grid needs their ticks to line up with the axis ticks.
type ScaleWithTicks = {
  (value: unknown): number;
  ticks: (count: number) => unknown[];
};

function hourLabel(hour: number): string {
  return DateTime.fromObject({ hour: hour % 24 })
    .toFormat("ha")
    .toLowerCase();
}

function HourLines({
  hours,
  unselectedWeekdays,
  onChangeUnselectedWeekdays,
  onSelectPoint,
}: {
  hours: FunnelCadence["hours"];
  unselectedWeekdays: Set<string>;
  onChangeUnselectedWeekdays: (unselectedWeekdays: Set<string>) => void;
  onSelectPoint: (weekday: number, hour: number) => void;
}) {
  const canvasTheme = useChartCanvasTheme();
  const gridOpacity = useChartGridOpacity();
  const colors = useChartColors();
  const muted = canvasTheme.axis.ticks.text.fill;

  const allSeries = useMemo<HourSeries[]>(() => {
    const cells = new Map(
      hours.map((cell) => [`${cell.weekday}:${cell.hour}`, cell]),
    );
    return WEEKDAYS.map((weekdayName, index) => ({
      id: weekdayName,
      data: HOURS.map((hour) => {
        const cell = cells.get(`${index + 1}:${hour}`);
        return {
          x: hour,
          y:
            cell === undefined
              ? null
              : Number(((cell.converted / cell.users) * 100).toFixed(1)),
          users: cell?.users ?? 0,
          converted: cell?.converted ?? 0,
        };
      }),
    }));
  }, [hours]);
  const series = allSeries.filter((s) => !unselectedWeekdays.has(s.id));
  const colorOf = (id: string | number) => colors[WEEKDAYS.indexOf(String(id))];

  const leftMargin = chartAxisMargin(PERCENT_TICK_LABEL_WIDTH, true);
  const bottomMargin = chartAxisMargin(CHART_TEXT_SIZE, true);

  const drawLines = useCallback<LineCustomCanvasLayer<HourSeries>>(
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

      ctx.save();
      const xs = gridDotPositions(
        LABELED_HOURS.map(x as ScaleWithTicks),
        innerWidth,
      );
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

      lineGenerator.context(ctx);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = LINE_WIDTH;
      for (const s of computed) {
        ctx.globalAlpha =
          activeSeries === null || s.id === activeSeries ? 1 : DIMMED_OPACITY;
        ctx.strokeStyle = s.color;
        ctx.beginPath();
        lineGenerator(s.data.map((d) => d.position));
        ctx.stroke();
        ctx.fillStyle = s.color;
        drawIsolatedPoints(ctx, s.data);
      }

      if (currentPoint) {
        ctx.globalAlpha = 1;
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
    [gridOpacity, muted],
  );

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-wrap gap-2">
        <DropdownSelect
          type={DropdownSelectType.MultiString}
          title="Select Days"
          items={WEEKDAYS.map((weekdayName, index) => ({
            value: weekdayName,
            label: weekdayName,
            color: colors[index],
          }))}
          initialSelected={series.map((s) => s.id)}
          onChangeSelected={(selected) =>
            onChangeUnselectedWeekdays(
              new Set(
                WEEKDAYS.filter(
                  (weekdayName) =>
                    !(selected as string[]).includes(weekdayName),
                ),
              ),
            )
          }
        />
      </div>
      <div className="relative w-full h-136 cursor-pointer">
        {series.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
            No days selected
          </p>
        )}
        <ResponsiveLineCanvas
          data={series}
          curve="linear"
          theme={canvasTheme}
          colors={({ id }) => colorOf(id)}
          layers={["axes", drawLines, "mesh"]}
          margin={{
            top: TOP_MARGIN,
            right: RIGHT_MARGIN,
            bottom: bottomMargin,
            left: leftMargin,
          }}
          xScale={{ type: "linear", min: 0, max: HOURS.length - 1 }}
          yScale={{ type: "linear", min: 0, max: "auto", nice: true }}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: CHART_TICK_SIZE,
            tickPadding: CHART_TICK_PADDING,
            tickValues: LABELED_HOURS,
            format: (value) => hourLabel(Number(value)),
            legend: "Hour of Day",
            legendOffset: bottomMargin - CHART_TEXT_SIZE / 2,
            legendPosition: "middle",
          }}
          axisLeft={{
            tickSize: CHART_TICK_SIZE,
            tickPadding: CHART_TICK_PADDING,
            tickValues: CHART_VALUE_TICK_COUNT,
            format: (value) => `${value}%`,
            legend: "Conversion",
            legendOffset: -(leftMargin - CHART_TEXT_SIZE / 2),
            legendPosition: "middle",
          }}
          enableGridX={false}
          enableGridY={false}
          onClick={(datum) => {
            if ("seriesId" in datum) {
              onSelectPoint(
                WEEKDAYS.indexOf(String(datum.seriesId)) + 1,
                datum.data.x,
              );
            }
          }}
          tooltip={({ point }) => (
            <PlotTooltipShell>
              <div className="flex flex-row items-center px-4 py-3">
                <PlotTooltipSwatch color={point.seriesColor} />
                <span className="px-2">
                  {point.seriesId} -{" "}
                  {formatShare(point.data.converted, point.data.users)}
                </span>
              </div>
              <Separator />
              <div className="px-4 py-3 flex flex-col gap-2">
                <p>
                  Hour: {hourLabel(point.data.x)} to{" "}
                  {hourLabel(point.data.x + 1)}
                </p>
                <p>Users entered: {numberToKMB(point.data.users)}</p>
                <p>Users converted: {numberToKMB(point.data.converted)}</p>
                <p className="text-muted-foreground">
                  Click to open last {point.seriesId} in Breakdown view
                </p>
              </div>
            </PlotTooltipShell>
          )}
        />
      </div>
    </div>
  );
}

export default function FunnelCadencePlot({
  status,
  hours,
  onSelectPoint,
}: {
  status: "pending" | "error" | "success";
  hours: FunnelCadence | undefined;
  onSelectPoint: (weekday: number, hour: number) => void;
}) {
  // The unselected weekdays live here because the lines unmount while a new span
  // or filter loads.
  const [unselectedWeekdays, setUnselectedWeekdays] = useState<Set<string>>(
    () => new Set(),
  );

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
      {status === "success" && hours?.hours.length === 0 && (
        <EmptyState
          icon={Clock}
          title="No users entered this funnel"
          description="Try different filters"
          className="h-144"
        />
      )}
      {status === "success" && hours && hours.hours.length > 0 && (
        <HourLines
          hours={hours.hours}
          unselectedWeekdays={unselectedWeekdays}
          onChangeUnselectedWeekdays={setUnselectedWeekdays}
          onSelectPoint={onSelectPoint}
        />
      )}
    </div>
  );
}
