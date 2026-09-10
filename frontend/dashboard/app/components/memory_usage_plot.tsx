"use client";

import type { LineCanvasLayer, LineCustomCanvasLayer } from "@nivo/line";
import { ResponsiveLineCanvas } from "@nivo/line";
import { useTheme } from "next-themes";
import React, { useMemo, useState } from "react";
import type {
  MemoryScope,
  MemoryThresholdEntry,
  MemoryUsagePlotPoint,
} from "../api/api_calls";
import { useChartCanvasTheme, useChartColor } from "../utils/shared_styles";
import { PlotTooltipShell, PlotTooltipSwatch } from "./plot_tooltip";
import {
  formatPlotTooltipDate,
  getPlotTimeGroupNivoConfig,
  PlotTimeGroup,
} from "../utils/time_utils";
import TabSelect from "./tab_select";

interface MemoryUsagePlotProps {
  data: MemoryUsagePlotPoint[];
  plotTimeGroup: PlotTimeGroup;
  // e.g. "Dynamic Memory Usage" (Android) or "Memory Footprint" (iOS).
  metricLabel: string;
  // Google Play's own "excessive memory usage" ceiling for the currently
  // filtered RAM tier — one dashed reference line per entry, color-matched
  // to that process state's own data line. Empty when Play doesn't publish
  // one for the current RAM tier filter (the common case) — never guessed
  // client-side.
  thresholds?: MemoryThresholdEntry[];
}

// A single, fixed line for iOS's data, which has no process-state concept.
const IOS_SERIES_ID = "usage";

const PROCESS_STATE_LABEL: Record<MemoryScope, string> = {
  foreground: "Foreground",
  user_perceived_service: "User-perceived service",
  background: "Background",
};

const BASE_CANVAS_LAYERS: LineCanvasLayer<any>[] = [
  "grid",
  "axes",
  "areas",
  "crosshair",
  "lines",
  "points",
  "slices",
  "mesh",
  "legends",
];

type PlotSeries = {
  id: string;
  data: {
    id: string;
    x: string;
    y: number;
    sessions: number;
  }[];
};
type PlotData = PlotSeries[];

enum Quantile {
  p50 = "p50",
  p90 = "p90",
  p95 = "p95",
}

const MemoryUsagePlot: React.FC<MemoryUsagePlotProps> = ({
  data,
  plotTimeGroup,
  metricLabel,
  thresholds,
}) => {
  const [quantile, setQuantile] = useState(Quantile.p90);
  const { theme } = useTheme();
  const chartColor = useChartColor();
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup);

  const canvasTheme = useChartCanvasTheme();

  // One line per process state actually present in the data (Android), or
  // a single fixed line (iOS, which has no process-state concept).
  const seriesColor = useMemo<Record<string, string>>(
    () => ({
      [IOS_SERIES_ID]: chartColor.blue,
      foreground: chartColor.blue,
      user_perceived_service: chartColor.violet,
      background: chartColor.amber,
    }),
    [chartColor],
  );

  const plot = useMemo<PlotData | undefined>(() => {
    if (!data) return undefined;

    const byState = new Map<string, PlotSeries["data"]>();
    data.forEach((d, index) => {
      const seriesId = d.process_state ?? IOS_SERIES_ID;
      const points = byState.get(seriesId) ?? [];
      points.push({
        id: seriesId + "." + index,
        x: d.datetime,
        // backend values are in KB; the axis and tooltip both read MB.
        y: (d[quantile] ?? 0) / 1024,
        sessions: d.sessions,
      });
      byState.set(seriesId, points);
    });

    return Array.from(byState.entries()).map(([id, points]) => ({
      id,
      data: points,
    }));
  }, [data, quantile]);

  const thresholdsToDraw = useMemo(
    () => thresholds?.filter((t) => t.mb > 0) ?? [],
    [thresholds],
  );

  // "auto" alone can put a threshold line above the visible plot area when
  // every reading is comfortably under it; extend the scale to always
  // include every drawn line.
  const yScaleMax = useMemo(() => {
    if (thresholdsToDraw.length === 0) return "auto" as const;
    const dataMax = Math.max(
      0,
      ...(plot?.flatMap((s) => s.data.map((d) => d.y)) ?? [0]),
    );
    const thresholdMax = Math.max(...thresholdsToDraw.map((t) => t.mb));
    return Math.max(dataMax, thresholdMax) * 1.05;
  }, [plot, thresholdsToDraw]);

  const thresholdLayer = useMemo<LineCustomCanvasLayer<any> | null>(() => {
    if (thresholdsToDraw.length === 0) return null;
    // Nivo's generic Series type collapses `yScale`'s inferred parameter to
    // `never` when the layer function is written directly against
    // LineCustomCanvasLayer<any> (a TS quirk with conditional types over
    // `any`); a locally-typed function cast once at the boundary avoids it.
    const draw = (
      ctx: CanvasRenderingContext2D,
      layerProps: { innerWidth: number; yScale: (value: number) => number },
    ) => {
      thresholdsToDraw.forEach((t) => {
        const color = seriesColor[t.process_state] ?? chartColor.red;
        const y = layerProps.yScale(t.mb);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(layerProps.innerWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.font = "11px sans-serif";
        ctx.textBaseline = "bottom";
        ctx.fillText(t.label, 4, y - 4);
        ctx.restore();
      });
    };
    return draw as unknown as LineCustomCanvasLayer<any>;
  }, [thresholdsToDraw, seriesColor, chartColor]);

  const layers = useMemo<LineCanvasLayer<any>[]>(
    () =>
      thresholdLayer
        ? ["grid", thresholdLayer, ...BASE_CANVAS_LAYERS.slice(1)]
        : BASE_CANVAS_LAYERS,
    [thresholdLayer],
  );

  if (!plot || plot.length === 0 || plot.every((s) => s.data.length === 0)) {
    return (
      <div className="flex font-body items-center justify-center w-full h-144">
        <p className="text-lg font-display text-center p-4">No Data</p>
      </div>
    );
  }

  return (
    <div
      className="flex font-body items-center justify-center w-full h-144"
      data-testid="memory-usage-chart"
    >
      <div className="flex flex-col w-full h-full">
        <div className="flex flex-wrap w-full items-center justify-between gap-2 p-2">
          <div className="flex flex-wrap items-center gap-3">
            {plot.map((series) => (
              <div key={series.id} className="flex items-center gap-1.5">
                <PlotTooltipSwatch
                  color={seriesColor[series.id] ?? chartColor.blue}
                />
                <p className="text-xs text-muted-foreground select-none">
                  {series.id === IOS_SERIES_ID
                    ? metricLabel
                    : PROCESS_STATE_LABEL[series.id as MemoryScope]}
                </p>
              </div>
            ))}
          </div>
          <TabSelect
            items={Object.values(Quantile)}
            selected={quantile}
            onChangeSelected={(item) => setQuantile(item as Quantile)}
          />
        </div>
        <div className="size-full">
          <ResponsiveLineCanvas
            data={plot}
            layers={layers}
            curve="monotoneX"
            theme={canvasTheme}
            enableArea={true}
            areaOpacity={0.1}
            colors={(series) =>
              seriesColor[String(series.id)] ?? chartColor.blue
            }
            margin={{ top: 20, right: 80, bottom: 140, left: 100 }}
            xFormat={timeConfig.xFormat}
            xScale={{
              format: timeConfig.xScaleFormat,
              precision: timeConfig.xScalePrecision,
              type: "time",
              useUTC: false,
            }}
            yScale={{
              type: "linear",
              min: 0,
              max: yScaleMax,
            }}
            yFormat=".0f"
            axisTop={null}
            axisRight={null}
            axisBottom={{
              legend: "Date",
              tickPadding: 10,
              legendOffset: 100,
              format: timeConfig.axisBottomFormat,
              tickRotation: 45,
              legendPosition: "middle",
            }}
            axisLeft={{
              tickSize: 1,
              tickPadding: 5,
              legend: `${metricLabel} (${quantile}), MB`,
              legendOffset: -80,
              legendPosition: "middle",
            }}
            pointSize={6}
            pointBorderWidth={1.5}
            pointColor={
              theme === "dark"
                ? "rgba(0, 0, 0, 255)"
                : "rgba(255, 255, 255, 255)"
            }
            pointBorderColor={{
              from: "seriesColor",
              modifiers: [["darker", 0.3]],
            }}
            enableGridX={false}
            enableGridY={false}
            tooltip={({ point }) => {
              const pointData = point.data as unknown as {
                xFormatted: string;
                yFormatted: string;
                sessions: number;
              };
              const seriesId = point.seriesId;
              const label =
                seriesId === IOS_SERIES_ID
                  ? metricLabel
                  : (PROCESS_STATE_LABEL[seriesId as MemoryScope] ?? seriesId);
              return (
                <PlotTooltipShell>
                  <p className="p-2 font-semibold">
                    {formatPlotTooltipDate(
                      pointData.xFormatted.toString(),
                      plotTimeGroup,
                    )}
                  </p>
                  <p className="px-2 pb-1">
                    Sessions: {(pointData.sessions ?? 0).toLocaleString()}
                  </p>
                  <div className="flex flex-row items-center px-2 py-0.5">
                    <PlotTooltipSwatch color={point.seriesColor} />
                    <div className="px-1" />
                    <p>
                      {label} {quantile}:{" "}
                      {Number(pointData.yFormatted).toFixed(0)} MB
                    </p>
                  </div>
                </PlotTooltipShell>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default MemoryUsagePlot;
