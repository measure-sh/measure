"use client";

import {
  MemoryUsageQuantile,
  transformMemoryUsagePlotData,
  type useMemoryUsagePlotQuery,
} from "@/app/query/hooks";
import { ResponsiveLineCanvas } from "@nivo/line";
import { MemoryStick } from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import { formatMemoryKilobytes } from "../utils/number_utils";
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
  type SiblingPoint,
} from "./plot_tooltip";
import EmptyState from "./empty_state";
import { SkeletonPlot } from "./skeleton";
import TabSelect from "./tab_select";

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
  const chartColors = useChartColors();
  const canvasTheme = useChartCanvasTheme();
  const plotTimeGroup = getPlotTimeGroupForRange(startDate, endDate);
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup);
  const plot = useMemo(() => {
    if (!rawData) return rawData;
    const transformed = transformMemoryUsagePlotData(rawData, quantile);
    return embedSiblingPoints(
      transformed,
      (_, index) => chartColors[index % chartColors.length],
    );
  }, [rawData, quantile, chartColors]);

  return (
    <section className="w-full font-body">
      <p className="font-display text-xl">Memory Usage</p>
      <div className="py-2" />
      <div className="flex items-center justify-center w-full h-144">
        {status === "pending" && <SkeletonPlot />}
        {status === "error" && (
          <p className="text-lg font-display text-center p-4">
            Error fetching plot, please change filters or refresh page to try
            again
          </p>
        )}
        {status === "success" && (!plot || plot.length === 0) && (
          <div data-testid="memory-usage-plot-no-data" className="size-full">
            <EmptyState
              icon={MemoryStick}
              title="No memory usage found"
              description="Try a wider time range or different filters"
              className="h-full"
            />
          </div>
        )}
        {status === "success" && plot && plot.length > 0 && (
          <div
            data-testid="memory-usage-plot-data"
            className="flex flex-col w-full h-full"
          >
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
                colors={chartColors}
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
                  format: (value) => formatMemoryKilobytes(Number(value)),
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
                  const pointData = point.data as unknown as {
                    xFormatted: string;
                    siblings: SiblingPoint[];
                  };
                  return (
                    <PlotTooltipShell>
                      <p className="p-2">
                        Date:{" "}
                        {formatPlotTooltipDate(
                          pointData.xFormatted,
                          plotTimeGroup,
                        )}
                      </p>
                      <p className="px-2 pb-1 text-muted-foreground">
                        App version (build) - Memory usage
                      </p>
                      {pointData.siblings.map((sibling) => (
                        <div className="flex items-center p-2" key={sibling.id}>
                          <PlotTooltipSwatch color={sibling.color} />
                          <span className="px-2">
                            {sibling.id} - {formatMemoryKilobytes(sibling.y)}
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
