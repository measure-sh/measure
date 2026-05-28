"use client";

import { useErrorsOverviewPlotQuery } from "@/app/query/hooks";
import { useFiltersStore } from "@/app/stores/provider";
import { ResponsiveLine } from "@nivo/line";
import { useTheme } from "next-themes";
import React from "react";
import { chartTheme, useChartColors } from "../utils/shared_styles";
import {
  formatPlotTooltipDate,
  getPlotTimeGroupForRange,
  getPlotTimeGroupNivoConfig,
} from "../utils/time_utils";
import { SkeletonPlot } from "./skeleton";

const ErrorsOverviewPlot: React.FC = () => {
  const filters = useFiltersStore((state) => state.filters);
  const { data: plot, status } = useErrorsOverviewPlotQuery();
  const { theme } = useTheme();
  const chartColors = useChartColors();
  const plotTimeGroup = getPlotTimeGroupForRange(
    filters.startDate,
    filters.endDate,
  );
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup);

  return (
    <div className="flex font-body items-center justify-center w-full h-[36rem]">
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
        <ResponsiveLine
          data={plot}
          curve="monotoneX"
          theme={chartTheme}
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
          yFormat=" >-.2f"
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
            legend: "Error instances",
            legendOffset: -80,
            legendPosition: "middle",
          }}
          pointSize={6}
          pointBorderWidth={1.5}
          pointColor={
            theme === "dark" ? "rgba(0, 0, 0, 255)" : "rgba(255, 255, 255, 255)"
          }
          pointBorderColor={{
            from: "serieColor",
            modifiers: [["darker", 0.3]],
          }}
          pointLabelYOffset={-12}
          useMesh={true}
          enableGridX={false}
          enableGridY={false}
          enableSlices="x"
          sliceTooltip={({ slice }) => {
            return (
              <div className="bg-background text-foreground border shadow-md flex flex-col p-2 text-xs rounded-md">
                <p className="p-2">
                  Date:{" "}
                  {formatPlotTooltipDate(
                    slice.points[0].data.xFormatted.toString(),
                    plotTimeGroup,
                  )}
                </p>
                {slice.points.map((point) => (
                  <div
                    className="flex flex-row items-center p-2"
                    key={point.id}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: point.serieColor }}
                    />
                    <div className="px-2" />
                    <p>{point.serieId.toString()} - </p>
                    <div className="px-2" />
                    <p>
                      {point.data.y.toString()}{" "}
                      {(point.data.y.valueOf() as number) > 1
                        ? "instances"
                        : "instance"}
                    </p>
                  </div>
                ))}
              </div>
            );
          }}
        />
      )}
    </div>
  );
};

export default ErrorsOverviewPlot;
