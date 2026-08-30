"use client";

import { type useBugReportsOverviewPlotQuery } from "@/app/query/hooks";
import { ResponsiveLineCanvas } from "@nivo/line";
import { useTheme } from "next-themes";
import React, { useMemo } from "react";
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
  SiblingPoint,
} from "./plot_tooltip";
import { SkeletonPlot } from "./skeleton";

const BugReportsOverviewPlot: React.FC<{
  startDate: string;
  endDate: string;
  query: ReturnType<typeof useBugReportsOverviewPlotQuery>;
}> = ({ startDate, endDate, query }) => {
  const { data: rawPlot, status } = query;
  const { theme } = useTheme();
  const chartColors = useChartColors();
  const canvasTheme = useChartCanvasTheme();
  const plotTimeGroup = getPlotTimeGroupForRange(startDate, endDate);
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup);

  const plot = useMemo(() => {
    if (!rawPlot) {
      return rawPlot;
    }
    return embedSiblingPoints(
      rawPlot,
      (_, index) => chartColors[index % chartColors.length],
    );
  }, [rawPlot, chartColors]);

  return (
    <div
      data-testid="bug-reports-plot"
      className="flex font-body items-center justify-center w-full h-144"
    >
      {status === "pending" && <SkeletonPlot />}
      {status === "error" && (
        <p className="text-lg font-display text-center p-4">
          Error fetching plot, please change filters or refresh page to try
          again
        </p>
      )}
      {status === "success" && plot === null && (
        <p
          data-testid="bug-reports-plot-no-data"
          className="text-lg font-display text-center p-4"
        >
          No Data
        </p>
      )}
      {status === "success" && plot !== null && plot !== undefined && (
        <div data-testid="bug-reports-plot-data" className="size-full">
          <ResponsiveLineCanvas
            data={plot}
            curve="monotoneX"
            theme={canvasTheme}
            enableArea={true}
            areaOpacity={0.1}
            colors={chartColors}
            margin={{ top: 40, right: 40, bottom: 140, left: 100 }}
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
            yFormat="d"
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
              format: (value) => (Number.isInteger(value) ? value : ""),
              legend: "Bug Reports",
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
                        {sibling.y.toLocaleString()}{" "}
                        {sibling.y > 1 ? "Bug Reports" : "Bug Report"}
                      </p>
                    </div>
                  ))}
                </PlotTooltipShell>
              );
            }}
          />
        </div>
      )}
    </div>
  );
};

export default BugReportsOverviewPlot;
