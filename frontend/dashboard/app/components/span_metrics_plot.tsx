"use client";

import {
  RootSpanMetricsQuantile,
  transformSpanMetricsPlotData,
  type useSpanMetricsPlotQuery,
} from "@/app/query/hooks";
import { ResponsiveLineCanvas } from "@nivo/line";
import { useTheme } from "next-themes";
import React, { useMemo, useState } from "react";
import { useChartCanvasTheme, useChartColors } from "../utils/shared_styles";
import {
  formatMillisToHumanReadable,
  formatPlotTooltipDate,
  getPlotTimeGroupForRange,
  getPlotTimeGroupNivoConfig,
} from "../utils/time_utils";
import {
  embedSiblingPoints,
  PlotTooltipShell,
  PlotTooltipSwatch,
  SiblingPoint,
} from "./plot_tooltip";
import { SkeletonPlot } from "./skeleton";
import TabSelect from "./tab_select";

const SpanMetricsPlot: React.FC<{
  startDate: string;
  endDate: string;
  query: ReturnType<typeof useSpanMetricsPlotQuery>;
}> = ({ startDate, endDate, query }) => {
  const [quantile, setQuantile] = useState<RootSpanMetricsQuantile>(
    RootSpanMetricsQuantile.p50,
  );
  const { data: rawData, status } = query;
  const { theme } = useTheme();
  const chartColors = useChartColors();
  const canvasTheme = useChartCanvasTheme();
  const plotTimeGroup = getPlotTimeGroupForRange(startDate, endDate);
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup);

  const plot = useMemo(() => {
    if (!rawData) {
      return rawData;
    }
    return embedSiblingPoints(
      transformSpanMetricsPlotData(rawData, quantile),
      (_: string, index: number) => chartColors[index % chartColors.length],
    );
  }, [rawData, quantile, chartColors]);

  function mapQuantileStringToQuantile(quantile: string) {
    switch (quantile) {
      case RootSpanMetricsQuantile.p50:
        return RootSpanMetricsQuantile.p50;
      case RootSpanMetricsQuantile.p90:
        return RootSpanMetricsQuantile.p90;
      case RootSpanMetricsQuantile.p95:
        return RootSpanMetricsQuantile.p95;
      case RootSpanMetricsQuantile.p99:
        return RootSpanMetricsQuantile.p99;
    }

    throw "Invalid quantile selected";
  }

  return (
    <div className="flex font-body items-center justify-center w-full h-144">
      {status === "pending" && <SkeletonPlot />}
      {status === "error" && (
        <p className="text-lg font-display text-center p-4">
          Error fetching plot, please change filters or refresh page to try
          again
        </p>
      )}
      {status === "success" && plot === null && (
        <p className="text-lg font-display text-center p-4">No Data</p>
      )}
      {status === "success" && plot !== null && plot !== undefined && (
        <div className="flex flex-col w-full h-full">
          <div className="flex flex-col w-full items-end p-2">
            <TabSelect
              items={Object.values(RootSpanMetricsQuantile)}
              selected={quantile}
              onChangeSelected={(item) =>
                setQuantile(mapQuantileStringToQuantile(item as string))
              }
            />
          </div>
          <div className="size-full">
            <ResponsiveLineCanvas
              data={plot}
              curve="monotoneX"
              theme={canvasTheme}
              enableArea={true}
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
              yScale={{
                type: "linear",
                min: 0,
                max: "auto",
              }}
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
                legend: `Duration (${quantile})`,
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
                        pointData.xFormatted.toString(),
                        plotTimeGroup,
                      )}
                    </p>
                    {pointData.siblings.map((sibling) => (
                      <div
                        className="flex flex-row items-center p-2"
                        key={sibling.id}
                      >
                        <PlotTooltipSwatch color={sibling.color} />
                        <div className="px-2" />
                        <p>{sibling.id} - </p>
                        <div className="px-2" />
                        <p>
                          {formatMillisToHumanReadable(sibling.y)} ({quantile})
                        </p>
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
  );
};

export default SpanMetricsPlot;
