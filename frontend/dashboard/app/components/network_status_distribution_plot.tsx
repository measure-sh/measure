"use client";

import { ResponsiveLine } from "@nivo/line";
import { useTheme } from "next-themes";
import React, { useMemo } from "react";
import { numberToKMB } from "../utils/number_utils";
import { chartTheme, useChartColor } from "../utils/shared_styles";
import { PlotTooltipShell, PlotTooltipSwatch } from "./plot_tooltip";
import {
  formatPlotTooltipDate,
  getPlotTimeGroupNivoConfig,
  PlotTimeGroup,
} from "../utils/time_utils";

interface StatusOverviewDataPoint {
  datetime: string;
  total_count: number;
  count_2xx: number;
  count_3xx: number;
  count_4xx: number;
  count_5xx: number;
}

interface NetworkStatusDistributionPlotProps {
  data: StatusOverviewDataPoint[];
  plotTimeGroup: PlotTimeGroup;
}

type PlotData = {
  id: string;
  data: {
    x: string;
    y: number;
    total_count: number;
    count_2xx: number;
    count_3xx: number;
    count_4xx: number;
    count_5xx: number;
  }[];
}[];

const seriesConfig = [
  { key: "count_2xx", id: "2xx" },
  { key: "count_3xx", id: "3xx" },
  { key: "count_4xx", id: "4xx" },
  { key: "count_5xx", id: "5xx" },
] as const;

const NetworkStatusDistributionPlot: React.FC<
  NetworkStatusDistributionPlotProps
> = ({ data, plotTimeGroup }) => {
  const { theme } = useTheme();
  const chartColor = useChartColor();
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup);

  const colorMap = {
    "2xx": chartColor.green,
    "3xx": chartColor.blue,
    "4xx": chartColor.amber,
    "5xx": chartColor.red,
  };

  const plot = useMemo<PlotData | undefined>(() => {
    if (!data) return undefined;

    return seriesConfig.map(({ key, id }) => ({
      id,
      data: data.map((d) => ({
        x: d.datetime,
        y: d[key],
        total_count: d.total_count,
        count_2xx: d.count_2xx,
        count_3xx: d.count_3xx,
        count_4xx: d.count_4xx,
        count_5xx: d.count_5xx,
      })),
    }));
  }, [data]);

  if (!plot || plot.length === 0 || plot[0].data.length === 0) {
    return (
      <div className="flex font-body items-center justify-center w-full h-[36rem]">
        <p className="text-lg font-display text-center p-4">No Data</p>
      </div>
    );
  }

  return (
    <div className="flex font-body items-center justify-center w-full h-[36rem]">
      <div className="size-full">
        <ResponsiveLine
          data={plot}
          curve="monotoneX"
          theme={chartTheme}
          enableArea={true}
          areaOpacity={0.1}
          colors={({ id }) => colorMap[id as keyof typeof colorMap] || "#888"}
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
            colorMap[seriesId as keyof typeof colorMap] || "#888"
          }
          pointLabelYOffset={-12}
          useMesh={true}
          enableGridX={false}
          enableGridY={false}
          enableSlices="x"
          sliceTooltip={({ slice }) => {
            const pointData = slice.points[0]?.data as unknown as {
              xFormatted: string;
              total_count: number;
              count_2xx: number;
              count_3xx: number;
              count_4xx: number;
              count_5xx: number;
            };
            const total = pointData?.total_count ?? 0;
            const pct = (count: number) =>
              total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
            return (
              <PlotTooltipShell>
                <p className="p-2 font-semibold">
                  {formatPlotTooltipDate(
                    slice.points[0].data.xFormatted.toString(),
                    plotTimeGroup,
                  )}
                </p>
                <p className="px-2 pb-1">Total: {total.toLocaleString()}</p>
                {/* nivo orders points by y-value, sort to maintain 2xx, 3xx, 4xx, 5xx order */}
                {[...slice.points]
                  .sort((a, b) =>
                    a.seriesId.toString().localeCompare(b.seriesId.toString()),
                  )
                  .map((point) => {
                    const count = Number(point.data.y);
                    return (
                      <div
                        className="flex flex-row items-center px-2 py-0.5"
                        key={point.id}
                      >
                        <PlotTooltipSwatch color={point.seriesColor} />
                        <div className="px-1" />
                        <p>
                          {point.seriesId}: {count.toLocaleString()} (
                          {pct(count)}%)
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

export default NetworkStatusDistributionPlot;
