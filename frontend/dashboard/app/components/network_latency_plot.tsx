"use client";

import { ResponsiveLineCanvas } from "@nivo/line";
import { useTheme } from "next-themes";
import React, { useMemo, useState } from "react";
import { useChartCanvasTheme, useChartColors } from "../utils/shared_styles";
import { PlotTooltipShell, PlotTooltipSwatch } from "./plot_tooltip";
import {
  formatMillisToHumanReadable,
  formatPlotTooltipDate,
  getPlotTimeGroupNivoConfig,
  PlotTimeGroup,
} from "../utils/time_utils";
import TabSelect from "./tab_select";

interface LatencyDataPoint {
  datetime: string;
  p50: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
  count: number;
}

interface NetworkLatencyPlotProps {
  data: LatencyDataPoint[];
  plotTimeGroup: PlotTimeGroup;
}

type PlotData = {
  id: string;
  data: {
    id: string;
    x: string;
    y: number;
    count: number;
  }[];
}[];

enum Quantile {
  p50 = "p50",
  p90 = "p90",
  p95 = "p95",
  p99 = "p99",
}

const NetworkLatencyPlot: React.FC<NetworkLatencyPlotProps> = ({
  data,
  plotTimeGroup,
}) => {
  const [quantile, setQuantile] = useState(Quantile.p95);
  const { theme } = useTheme();
  const chartColors = useChartColors();
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup);

  const canvasTheme = useChartCanvasTheme();

  const plot = useMemo<PlotData | undefined>(() => {
    if (!data) return undefined;

    return [
      {
        id: quantile,
        data: data.map((d, index) => ({
          id: quantile + "." + index,
          x: d.datetime,
          y: d[quantile] ?? 0,
          count: d.count,
        })),
      },
    ];
  }, [data, quantile]);

  if (!plot || plot.length === 0 || plot[0].data.length === 0) {
    return (
      <div className="flex font-body items-center justify-center w-full h-144">
        <p className="text-lg font-display text-center p-4">No Data</p>
      </div>
    );
  }

  return (
    <div className="flex font-body items-center justify-center w-full h-144">
      <div className="flex flex-col w-full h-full">
        <div className="flex flex-col w-full items-end p-2">
          <TabSelect
            items={Object.values(Quantile)}
            selected={quantile}
            onChangeSelected={(item) => setQuantile(item as Quantile)}
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
                yFormatted: string;
                count: number;
              };
              return (
                <PlotTooltipShell>
                  <p className="p-2 font-semibold">
                    {formatPlotTooltipDate(
                      pointData.xFormatted.toString(),
                      plotTimeGroup,
                    )}
                  </p>
                  <p className="px-2 pb-1">
                    Requests: {(pointData.count ?? 0).toLocaleString()}
                  </p>
                  <div className="flex flex-row items-center px-2 py-0.5">
                    <PlotTooltipSwatch color={point.seriesColor} />
                    <div className="px-1" />
                    <p>
                      {quantile}:{" "}
                      {formatMillisToHumanReadable(
                        Number(pointData.yFormatted),
                      )}
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

export default NetworkLatencyPlot;
