"use client";

import type { useMemoryUsageDistributionQuery } from "@/app/query/hooks";
import { ResponsiveBar } from "@nivo/bar";
import { chartTheme, useChartColors } from "../utils/shared_styles";
import { PlotTooltipShell, PlotTooltipSwatch } from "./plot_tooltip";
import { SkeletonPlot } from "./skeleton";

const MEMORY_BUCKETS = [
  "0-100",
  "100-200",
  "200-300",
  "300-400",
  "400-500",
  "500-600",
  "600-700",
  "700-800",
  "800-900",
  "900+",
];

export default function MemoryUsageDistribution({
  query,
}: {
  query: ReturnType<typeof useMemoryUsageDistributionQuery>;
}) {
  const colors = useChartColors();
  const { data, status } = query;
  const points = MEMORY_BUCKETS.map((bucket) => {
    const point = data?.find((item) => item.bucket === bucket);
    return {
      bucket,
      percentage: point?.percentage ?? 0,
      sampleCount: point?.sample_count ?? 0,
    };
  });

  return (
    <section className="w-full font-body">
      <h2 className="mb-2 font-display text-xl">Distribution</h2>
      <div className="flex h-144 w-full items-center justify-center">
        {status === "pending" && <SkeletonPlot />}
        {status === "error" && (
          <p className="p-4 text-center text-lg font-display">
            Error fetching distribution, please change filters or refresh page
            to try again
          </p>
        )}
        {status === "success" && !data?.length && (
          <p className="p-4 text-center text-lg font-display">No Data</p>
        )}
        {status === "success" && data && data.length > 0 && (
          <div className="size-full">
            <ResponsiveBar
              data={points}
              keys={["percentage"]}
              indexBy="bucket"
              theme={chartTheme}
              colors={[colors[0]]}
              margin={{ top: 20, right: 20, bottom: 110, left: 80 }}
              padding={0.25}
              valueScale={{ type: "linear", min: 0, max: 100 }}
              enableLabel={false}
              enableGridX={false}
              enableGridY={false}
              axisTop={null}
              axisRight={null}
              axisBottom={{
                tickRotation: 45,
                tickPadding: 10,
                legend: "Memory usage (MB)",
                legendOffset: 85,
                legendPosition: "middle",
              }}
              axisLeft={{
                tickSize: 1,
                tickPadding: 5,
                format: (value) => `${value}%`,
                legend: "Percentage of samples",
                legendOffset: -60,
                legendPosition: "middle",
              }}
              tooltip={({ color, indexValue, value, data }) => (
                <PlotTooltipShell>
                  <div className="flex items-center p-2">
                    <PlotTooltipSwatch color={color} />
                    <span className="px-2">
                      {indexValue} MB: {Number(value).toFixed(1)}% (
                      {data.sampleCount} samples)
                    </span>
                  </div>
                </PlotTooltipShell>
              )}
            />
          </div>
        )}
      </div>
    </section>
  );
}
