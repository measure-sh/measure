"use client";

import type {
  ScatterPlotCustomCanvasLayer,
  ScatterPlotLayerId,
} from "@nivo/scatterplot";
import { ResponsiveScatterPlotCanvas } from "@nivo/scatterplot";
import React, { useMemo } from "react";
import type {
  MemoryScope,
  MemoryThresholdEntry,
  MemoryUsagePercentile,
  MemoryUsagePlotPoint,
} from "../api/api_calls";
import { useChartCanvasTheme, useChartColor } from "../utils/shared_styles";
import { PlotTooltipShell, PlotTooltipSwatch } from "./plot_tooltip";
import {
  formatPlotTooltipDate,
  getPlotTimeGroupNivoConfig,
  PlotTimeGroup,
} from "../utils/time_utils";

interface MemoryUsagePlotProps {
  data: MemoryUsagePlotPoint[];
  plotTimeGroup: PlotTimeGroup;
  // p50/p90/p95 across sessions, one entry per process state — drawn as
  // reference lines over the scatter of individual session points, so a
  // viewer can see both the real spread and where the percentile cutoffs
  // fall within it. iOS gets one entry with no process_state.
  percentiles?: MemoryUsagePercentile[];
  // e.g. "Dynamic Memory Usage" (Android) or "Memory Footprint" (iOS).
  metricLabel: string;
  // Google Play's own "excessive memory usage" ceiling for the currently
  // filtered RAM tier — one dashed reference line per entry, color-matched
  // to that process state's own points. Empty when Play doesn't publish
  // one for the current RAM tier filter (the common case) — never guessed
  // client-side.
  thresholds?: MemoryThresholdEntry[];
}

// A single, fixed series for iOS's data, which has no process-state concept.
const IOS_SERIES_ID = "usage";

const PROCESS_STATE_LABEL: Record<MemoryScope, string> = {
  foreground: "Foreground",
  user_perceived_service: "User-perceived service",
  background: "Background",
};

const BASE_LAYERS: ScatterPlotLayerId[] = [
  "grid",
  "axes",
  "mesh",
  "nodes",
  "legends",
];

type PlotDatum = {
  x: string;
  y: number;
  sessionId: string;
};
type PlotSeries = { id: string; data: PlotDatum[] };
type PlotData = PlotSeries[];

// A horizontal reference line drawn across the whole plot: either a Play
// threshold or a state's p90 across sessions. A state can have both at
// once, so lines are also distinguished by dash pattern and weight, not
// just color.
type ReferenceLine = {
  mb: number;
  color: string;
  dash: number[];
  width: number;
  label: string;
};

const MemoryUsagePlot: React.FC<MemoryUsagePlotProps> = ({
  data,
  plotTimeGroup,
  percentiles,
  metricLabel,
  thresholds,
}) => {
  const chartColor = useChartColor();
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup);
  const canvasTheme = useChartCanvasTheme();

  // One series per process state actually present in the data (Android),
  // or a single fixed series (iOS, which has no process-state concept).
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

    const byState = new Map<string, PlotDatum[]>();
    data.forEach((d) => {
      const seriesId = d.process_state ?? IOS_SERIES_ID;
      const points = byState.get(seriesId) ?? [];
      // backend values are in KB; the axis and tooltip both read MB.
      points.push({
        x: d.datetime,
        y: d.value_kb / 1024,
        sessionId: d.session_id,
      });
      byState.set(seriesId, points);
    });

    return Array.from(byState.entries()).map(([id, points]) => ({
      id,
      data: points,
    }));
  }, [data]);

  const referenceLines = useMemo<ReferenceLine[]>(() => {
    const lines: ReferenceLine[] = [];

    (thresholds ?? [])
      .filter((t) => t.mb > 0)
      .forEach((t) => {
        lines.push({
          mb: t.mb,
          color: seriesColor[t.process_state] ?? chartColor.red,
          dash: [6, 4],
          width: 1.5,
          label: t.label,
        });
      });

    // Only p90 — the same primary reference used elsewhere in this feature
    // (the ranked sessions list, the status badges) — not the full p50/p95
    // spread, which got cluttered with up to three states on one chart.
    (percentiles ?? []).forEach((p) => {
      if (p.p90 <= 0) return;
      const color =
        seriesColor[p.process_state ?? IOS_SERIES_ID] ?? chartColor.blue;
      const stateLabel = p.process_state
        ? PROCESS_STATE_LABEL[p.process_state]
        : metricLabel;
      lines.push({
        mb: p.p90 / 1024,
        color,
        dash: [6, 3],
        width: 1.5,
        label: `${stateLabel} p90`,
      });
    });

    return lines;
  }, [thresholds, percentiles, seriesColor, chartColor, metricLabel]);

  // "auto" alone can put a reference line above the visible plot area when
  // every point is comfortably under it; extend the scale to always
  // include every drawn line and point.
  const yScaleMax = useMemo(() => {
    const dataMax = Math.max(
      0,
      ...(plot?.flatMap((s) => s.data.map((d) => d.y)) ?? [0]),
    );
    const lineMax = Math.max(0, ...referenceLines.map((l) => l.mb));
    return Math.max(dataMax, lineMax, 1) * 1.05;
  }, [plot, referenceLines]);

  const referenceLinesLayer =
    useMemo<ScatterPlotCustomCanvasLayer<PlotDatum> | null>(() => {
      if (referenceLines.length === 0) return null;
      const draw: ScatterPlotCustomCanvasLayer<PlotDatum> = (
        ctx,
        layerProps,
      ) => {
        // Draw every line at its real position first — a threshold and its
        // state's p90 can land within a pixel or two of each other, and the
        // lines staying close is informative. Only the text labels get
        // pushed apart, in a second pass, so they stay legible without
        // moving the lines they describe.
        const positions = referenceLines.map((line) =>
          layerProps.yScale(line.mb),
        );
        referenceLines.forEach((line, i) => {
          const y = positions[i];
          ctx.save();
          ctx.strokeStyle = line.color;
          ctx.lineWidth = line.width;
          ctx.setLineDash(line.dash);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(layerProps.innerWidth, y);
          ctx.stroke();
          ctx.restore();
        });

        const order = referenceLines
          .map((_, i) => i)
          .sort((a, b) => positions[a] - positions[b]);
        const MIN_LABEL_GAP = 14;
        let previousY = -Infinity;
        order.forEach((i) => {
          const y = Math.max(positions[i], previousY + MIN_LABEL_GAP);
          previousY = y;
          const line = referenceLines[i];
          ctx.save();
          ctx.fillStyle = line.color;
          ctx.font = "11px sans-serif";
          ctx.textBaseline = "bottom";
          ctx.fillText(line.label, 4, y - 1);
          ctx.restore();
        });
      };
      return draw;
    }, [referenceLines]);

  const layers = useMemo<
    (ScatterPlotLayerId | ScatterPlotCustomCanvasLayer<PlotDatum>)[]
  >(
    () =>
      referenceLinesLayer
        ? ["grid", referenceLinesLayer, ...BASE_LAYERS.slice(1)]
        : BASE_LAYERS,
    [referenceLinesLayer],
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
        <div className="flex flex-wrap items-center gap-3 p-2">
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
        <div className="size-full">
          <ResponsiveScatterPlotCanvas
            data={plot}
            layers={layers}
            theme={canvasTheme}
            colors={(series) =>
              seriesColor[String(series.serieId)] ?? chartColor.blue
            }
            nodeSize={6}
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
              legend: `${metricLabel}, MB`,
              legendOffset: -80,
              legendPosition: "middle",
            }}
            enableGridX={false}
            enableGridY={false}
            tooltip={({ node }) => {
              const label =
                node.serieId === IOS_SERIES_ID
                  ? metricLabel
                  : (PROCESS_STATE_LABEL[node.serieId as MemoryScope] ??
                    String(node.serieId));
              return (
                <PlotTooltipShell>
                  <p className="p-2 font-semibold">
                    {formatPlotTooltipDate(
                      node.formattedX.toString(),
                      plotTimeGroup,
                    )}
                  </p>
                  <p className="px-2 pb-1">
                    Session: {node.data.sessionId.slice(0, 8)}
                  </p>
                  <div className="flex flex-row items-center px-2 py-0.5">
                    <PlotTooltipSwatch
                      color={
                        seriesColor[String(node.serieId)] ?? chartColor.blue
                      }
                    />
                    <div className="px-1" />
                    <p>
                      {label}: {Number(node.formattedY).toFixed(0)} MB
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
