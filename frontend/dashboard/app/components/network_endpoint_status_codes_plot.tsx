"use client";

import { ResponsiveLineCanvas } from "@nivo/line";
import { useTheme } from "next-themes";
import React, { useMemo } from "react";
import { numberToKMB } from "../utils/number_utils";
import { useChartCanvasTheme, useChartColor } from "../utils/shared_styles";
import { PlotTooltipShell, PlotTooltipSwatch } from "./plot_tooltip";
import {
  formatPlotTooltipDate,
  getPlotTimeGroupNivoConfig,
  PlotTimeGroup,
} from "../utils/time_utils";

interface StatusCodeDataPoint {
  datetime: string;
  total_count: number;
  [key: string]: number | string;
}

interface NetworkEndpointStatusCodesPlotProps {
  statusCodes: number[];
  data: StatusCodeDataPoint[];
  plotTimeGroup: PlotTimeGroup;
}

const statusCodeCount = (dataPoint: StatusCodeDataPoint, code: number) => {
  const count = dataPoint[`count_${code}`];
  return typeof count === "number" ? count : 0;
};

const NetworkEndpointStatusCodesPlot: React.FC<
  NetworkEndpointStatusCodesPlotProps
> = ({ statusCodes, data, plotTimeGroup }) => {
  const { theme } = useTheme();
  const chartColor = useChartColor();
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup);
  const canvasTheme = useChartCanvasTheme();

  const bucketColors: Record<number, string> = {
    2: chartColor.green,
    3: chartColor.blue,
    4: chartColor.amber,
    5: chartColor.red,
  };
  const statusCodeColor = (code: number) =>
    bucketColors[Math.floor(code / 100)] || "#888";

  const plot = useMemo(() => {
    if (data.length === 0 || statusCodes.length === 0) {
      return undefined;
    }

    return statusCodes.map((code) => ({
      id: String(code),
      data: data.map((dataPoint) => ({
        x: dataPoint.datetime,
        y: statusCodeCount(dataPoint, code),
        total_count: dataPoint.total_count,
        source: dataPoint,
      })),
    }));
  }, [data, statusCodes]);

  if (!plot || plot.length === 0 || plot[0].data.length === 0) {
    return (
      <div className="flex font-body items-center justify-center w-full h-144">
        <p className="text-lg font-display text-center p-4">No Data</p>
      </div>
    );
  }

  return (
    <div className="flex font-body items-center justify-center w-full h-144">
      <div className="size-full">
        <ResponsiveLineCanvas
          data={plot}
          curve="monotoneX"
          theme={canvasTheme}
          enableArea={true}
          areaOpacity={0.1}
          colors={({ id }) => statusCodeColor(Number(id))}
          margin={{ top: 20, right: 80, bottom: 140, left: 80 }}
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
            format: (value) =>
              Number.isInteger(value) ? numberToKMB(value) : "",
            legend: "Requests",
            legendOffset: -60,
            legendPosition: "middle",
          }}
          pointSize={6}
          pointBorderWidth={1.5}
          pointColor={
            theme === "dark" ? "rgba(0, 0, 0, 255)" : "rgba(255, 255, 255, 255)"
          }
          pointBorderColor={({ seriesId }: { seriesId: string }) =>
            statusCodeColor(Number(seriesId))
          }
          enableGridX={false}
          enableGridY={false}
          tooltip={({ point }) => {
            const pointData = point.data as unknown as {
              xFormatted: string;
              total_count: number;
              source: StatusCodeDataPoint;
            };
            const total = pointData.total_count ?? 0;
            const percentage = (count: number) =>
              total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
            return (
              <PlotTooltipShell>
                <p className="p-2 font-semibold">
                  {formatPlotTooltipDate(
                    pointData.xFormatted.toString(),
                    plotTimeGroup,
                  )}
                </p>
                <p className="px-2 pb-1">Total: {total.toLocaleString()}</p>
                {statusCodes.map((code) => {
                  const count = statusCodeCount(pointData.source, code);
                  return (
                    <div
                      className="flex flex-row items-center px-2 py-0.5"
                      key={code}
                    >
                      <PlotTooltipSwatch color={statusCodeColor(code)} />
                      <div className="px-1" />
                      <p>
                        {code}: {count.toLocaleString()} ({percentage(count)}%)
                      </p>
                    </div>
                  );
                })}
              </PlotTooltipShell>
            );
          }}
          legends={[]}
        />
      </div>
    </div>
  );
};

export default NetworkEndpointStatusCodesPlot;
