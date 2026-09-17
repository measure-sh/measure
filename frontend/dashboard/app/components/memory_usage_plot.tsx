"use client";

import {
  MemoryUsageQuantile,
  transformMemoryUsagePlotData,
  type useMemoryUsagePlotQuery,
} from "@/app/query/hooks";
import { ResponsiveLineCanvas } from "@nivo/line";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import { useChartCanvasTheme, useChartColors } from "../utils/shared_styles";
import {
  formatPlotTooltipDate,
  getPlotTimeGroupForRange,
  getPlotTimeGroupNivoConfig,
} from "../utils/time_utils";
import {
  embedSiblingPoints,
  PlotTooltipShell,
  PlotTooltipSwatch,
} from "./plot_tooltip";
import { SkeletonPlot } from "./skeleton";
import TabSelect from "./tab_select";

function formatMemory(value: number) {
  if (value < 1024) return `${Math.round(value)} KB`;
  const mb = value / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export default function MemoryUsagePlot({
  startDate,
  endDate,
  query,
}: {
  startDate: string;
  endDate: string;
  query: ReturnType<typeof useMemoryUsagePlotQuery>;
}) {
  const [quantile, setQuantile] = useState(MemoryUsageQuantile.p90);
  const { data: rawData, status } = query;
  const { theme } = useTheme();
  const colors = useChartColors();
  const canvasTheme = useChartCanvasTheme();
  const timeGroup = getPlotTimeGroupForRange(startDate, endDate);
  const timeConfig = getPlotTimeGroupNivoConfig(timeGroup);
  const plot = useMemo(() => {
    if (!rawData) return rawData;
    const transformed = transformMemoryUsagePlotData(rawData, quantile);
    return embedSiblingPoints(
      transformed,
      (_, index) => colors[index % colors.length],
    );
  }, [rawData, quantile, colors]);

  return (
    <section className="w-full font-body">
      <div className="flex items-center justify-center w-full h-144">
        {status === "pending" && <SkeletonPlot />}
        {status === "error" && (
          <p className="text-lg font-display text-center p-4">
            Error fetching plot, please change filters or refresh page to try
            again
          </p>
        )}
        {status === "success" && (!plot || plot.length === 0) && (
          <p className="text-lg font-display text-center p-4">No Data</p>
        )}
        {status === "success" && plot && plot.length > 0 && (
          <div className="flex flex-col w-full h-full">
            <div className="flex justify-end p-2">
              <TabSelect
                items={Object.values(MemoryUsageQuantile)}
                selected={quantile}
                onChangeSelected={(item) =>
                  setQuantile(item as MemoryUsageQuantile)
                }
              />
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveLineCanvas
                data={plot}
                curve="monotoneX"
                theme={canvasTheme}
                enableArea
                areaOpacity={0.1}
                colors={colors}
                margin={{ top: 20, right: 40, bottom: 140, left: 100 }}
                xFormat={timeConfig.xFormat}
                xScale={{
                  format: timeConfig.xScaleFormat,
                  precision: timeConfig.xScalePrecision,
                  type: "time",
                  useUTC: false,
                }}
                yScale={{ type: "linear", min: 0, max: "auto" }}
                yFormat=".2f"
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
                  format: (value) => formatMemory(Number(value)),
                  legend: "Memory usage",
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
                  const data = point.data as unknown as {
                    xFormatted: string;
                    siblings: { id: string; y: number; color: string }[];
                  };
                  return (
                    <PlotTooltipShell>
                      <p className="p-2">
                        Date:{" "}
                        {formatPlotTooltipDate(data.xFormatted, timeGroup)}
                      </p>
                      <p className="px-2 pb-1 text-muted-foreground">
                        App version (build) - Memory usage
                      </p>
                      {data.siblings.map((sibling) => (
                        <div className="flex items-center p-2" key={sibling.id}>
                          <PlotTooltipSwatch color={sibling.color} />
                          <span className="px-2">
                            {sibling.id} - {formatMemory(sibling.y)}
                          </span>
                        </div>
                      ))}
                    </PlotTooltipShell>
                  );
                }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
