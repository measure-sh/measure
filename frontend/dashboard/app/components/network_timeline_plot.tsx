"use client";

import { Slider } from "@/app/components/slider";
import { useChartCanvasTheme } from "@/app/utils/shared_styles";
import { formatMillisToHumanReadable } from "@/app/utils/time_utils";
import { PlotTooltipShell } from "@/app/components/plot_tooltip";
import { ResponsiveHeatMapCanvas } from "@nivo/heatmap";
import { useTheme } from "next-themes";
import React, { useEffect, useMemo, useState } from "react";

export interface NetworkTimelineDataPoint {
  elapsed: number;
  domain: string;
  path_pattern: string;
  count: number;
}

export interface NetworkTimelineData {
  interval: number;
  points: NetworkTimelineDataPoint[];
}

interface Props {
  data: NetworkTimelineData;
}

const NetworkTimelinePlot: React.FC<Props> = ({ data }) => {
  const { theme } = useTheme();
  const interval = data.interval;
  const canvasTheme = useChartCanvasTheme();

  const { endpointOrder, bucketMap, minBucket, maxBucket } = useMemo(() => {
    // Group by endpoint and bucket (already aligned from backend), and order
    // endpoints by total count descending (busiest at top).
    const endpointTotals = new Map<string, number>();
    const bucketMap = new Map<string, Map<number, number>>();
    let min = Infinity;
    let max = -Infinity;

    for (const d of data.points ?? []) {
      const endpoint = `${d.domain}${d.path_pattern}`;
      endpointTotals.set(
        endpoint,
        (endpointTotals.get(endpoint) ?? 0) + d.count,
      );

      min = Math.min(min, d.elapsed);
      max = Math.max(max, d.elapsed);

      let epBuckets = bucketMap.get(endpoint);
      if (!epBuckets) {
        epBuckets = new Map();
        bucketMap.set(endpoint, epBuckets);
      }
      epBuckets.set(d.elapsed, (epBuckets.get(d.elapsed) ?? 0) + d.count);
    }

    const endpointOrder = Array.from(endpointTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([endpoint]) => endpoint);

    if (min === Infinity) {
      return { endpointOrder, bucketMap, minBucket: 0, maxBucket: 0 };
    }
    return { endpointOrder, bucketMap, minBucket: min, maxBucket: max };
  }, [data]);

  const sliderMin = Math.min(minBucket + 60, maxBucket);
  const defaultEnd = Math.min(minBucket + 120 - interval, maxBucket);
  const [rangeEnd, setRangeEnd] = useState(defaultEnd);
  const [debouncedRangeEnd, setDebouncedRangeEnd] = useState(defaultEnd);
  // Reset the range when the bucket bounds change.
  const [prevBounds, setPrevBounds] = useState({ minBucket, maxBucket });
  if (
    prevBounds.minBucket !== minBucket ||
    prevBounds.maxBucket !== maxBucket
  ) {
    setPrevBounds({ minBucket, maxBucket });
    setRangeEnd(defaultEnd);
    setDebouncedRangeEnd(defaultEnd);
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedRangeEnd(rangeEnd), 50);
    return () => clearTimeout(timer);
  }, [rangeEnd]);

  const handleRangeChange = (value: number) => {
    setRangeEnd(value);
  };

  // Cells narrower than a few pixels are painted over by their own 1px
  // borders and the chart reads as solid black, so wide ranges are shown as
  // coarser windows: enough native buckets are merged into each column to
  // keep the column count at or below this limit.
  const maxColumns = 120;

  const filteredHeatmapData = useMemo(() => {
    if (endpointOrder.length === 0) {
      return [];
    }

    // Column widths snap to round durations so axis labels and tooltip
    // ranges read as natural time steps, and dragging the slider only
    // changes the width when the range crosses a step boundary. The
    // smallest step that keeps the column count within the limit wins;
    // doubling past the last step covers ranges beyond it.
    const columnSteps = [
      5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400,
    ];
    const visibleSeconds = debouncedRangeEnd - minBucket + interval;
    let columnInterval =
      columnSteps.find(
        (step) =>
          step >= interval &&
          step % interval === 0 &&
          visibleSeconds / step <= maxColumns,
      ) ?? columnSteps[columnSteps.length - 1];
    while (visibleSeconds / columnInterval > maxColumns) {
      columnInterval *= 2;
    }
    const bucketsPerColumn = columnInterval / interval;

    const columns: number[] = [];
    for (let b = minBucket; b <= debouncedRangeEnd; b += columnInterval) {
      columns.push(b);
    }

    return endpointOrder.map((endpoint) => {
      const epBuckets = bucketMap.get(endpoint) ?? new Map<number, number>();
      return {
        id: endpoint,
        data: columns.map((b) => {
          // Each bucket holds the average requests per session in its 5
          // second window, so summing the buckets inside a column gives the
          // average for the column's whole window.
          let sum = 0;
          let hasData = false;
          for (let i = 0; i < bucketsPerColumn; i++) {
            const count = epBuckets.get(b + i * interval);
            if (count !== undefined) {
              sum += count;
              hasData = true;
            }
          }
          return {
            x: formatMillisToHumanReadable(b * 1000),
            y: hasData ? sum : null,
            rangeLabel: `${formatMillisToHumanReadable(b * 1000)} - ${formatMillisToHumanReadable((b + columnInterval) * 1000)}`,
          };
        }),
      };
    });
  }, [endpointOrder, bucketMap, minBucket, debouncedRangeEnd, interval]);

  const containerHeight = Math.min(
    576,
    Math.max(200, filteredHeatmapData.length * 40 + 160),
  );

  if (filteredHeatmapData.length === 0) {
    return (
      <div className="flex font-body items-center justify-center w-full h-144">
        <p className="text-lg font-display text-center p-4">No Data</p>
      </div>
    );
  }

  // Show every Nth tick label to avoid crowding
  const totalBuckets = filteredHeatmapData[0]?.data.length ?? 0;
  const tickInterval = Math.max(1, Math.ceil(totalBuckets / 20));
  const tickValues =
    filteredHeatmapData[0]?.data
      .map((d) => d.x)
      .filter((_, i) => i % tickInterval === 0) ?? [];

  return (
    <div className="flex font-body flex-col items-center w-full">
      {maxBucket > minBucket && (
        <div className="flex flex-col gap-2 w-full py-4">
          <div className="flex items-center text-muted-foreground justify-end">
            <label className="font-body text-xs">
              Showing{" "}
              {formatMillisToHumanReadable((rangeEnd + interval) * 1000)} from
              session start
            </label>
          </div>
          <Slider
            value={[rangeEnd]}
            onValueChange={(value) => handleRangeChange(value[0])}
            min={sliderMin}
            max={maxBucket}
            step={interval}
            className="w-full"
          />
        </div>
      )}
      <div className="size-full" style={{ height: containerHeight }}>
        <ResponsiveHeatMapCanvas
          data={filteredHeatmapData}
          theme={canvasTheme}
          colors={
            theme === "dark"
              ? { type: "diverging", colors: ["#cad8ea", "#5e98c4", "#1f77b4"] }
              : { type: "diverging", colors: ["#fee6ce", "#fdae6b", "#e6550d"] }
          }
          emptyColor={theme === "dark" ? "#1a1a1a" : "#f9f9f9"}
          opacity={1}
          activeOpacity={1}
          inactiveOpacity={theme === "dark" ? 0.9 : 0.7}
          borderWidth={1}
          borderColor={theme === "dark" ? "#000000" : "#ffffff"}
          margin={{ top: 20, right: 40, bottom: 120, left: 180 }}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            legend: "Time Since Session Start",
            legendPosition: "middle",
            legendOffset: 100,
            tickPadding: 10,
            tickRotation: 45,
            tickValues,
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            format: (value: string) =>
              value.length > 32 ? value.slice(0, 29) + "..." : value,
          }}
          enableLabels={false}
          hoverTarget="cell"
          tooltip={({ cell }) => {
            if (cell.value === null) return null;
            const rangeLabel = (cell.data as any).rangeLabel as string;
            return (
              <PlotTooltipShell>
                <p className="font-semibold">{cell.serieId}</p>
                <p className="mt-1">{rangeLabel}</p>
                <p className="mt-0.5">
                  {cell.value !== null ? Number(cell.value).toFixed(2) : "0"}{" "}
                  avg. requests/session
                </p>
              </PlotTooltipShell>
            );
          }}
          legends={[]}
        />
      </div>
    </div>
  );
};

export default NetworkTimelinePlot;
