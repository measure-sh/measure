"use client";

import { useErrorsDetailsPlotQuery } from "@/app/query/hooks";
import { useFiltersStore } from "@/app/stores/provider";
import { ResponsiveLineCanvas } from "@nivo/line";
import { DateTime } from "luxon";
import { useTheme } from "next-themes";
import React, { useMemo } from "react";
import { numberToKMB } from "../utils/number_utils";
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

const demoDataDate = DateTime.now();
const demoData = [
  {
    id: "1.0.0 (100)",
    data: [
      { datetime: demoDataDate.toFormat("yyyy-MM-dd"), instances: 1796 },
      {
        datetime: demoDataDate.minus({ days: 1 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 2 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 3 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 4 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 5 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 6 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
    ],
  },
  {
    id: "2.0.0 (200)",
    data: [
      { datetime: demoDataDate.toFormat("yyyy-MM-dd"), instances: 2204 },
      {
        datetime: demoDataDate.minus({ days: 1 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 2 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 3 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 4 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 5 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 6 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
    ],
  },
];

interface ErrorsDetailsPlotProps {
  errorGroupId: string;
  demo?: boolean;
}

type ErrorsDetailsPlotData = {
  id: string;
  data: {
    x: string;
    y: number;
  }[];
}[];

const demoPlot: ErrorsDetailsPlotData = demoData.map((item: any) => ({
  id: item.id,
  data: item.data.map((d: any) => ({ x: d.datetime, y: d.instances })),
}));

const ErrorsDetailsPlot: React.FC<ErrorsDetailsPlotProps> = ({
  errorGroupId,
  demo = false,
}) => {
  const filters = useFiltersStore((state) => state.filters);
  const { data: queryPlot, status } = useErrorsDetailsPlotQuery(errorGroupId);
  const { theme } = useTheme();
  const chartColors = useChartColors();
  const canvasTheme = useChartCanvasTheme();
  const plotTimeGroup = getPlotTimeGroupForRange(
    filters.startDate,
    filters.endDate,
  );
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup);

  const effectiveStatus = demo ? "success" : status;
  const rawPlot = demo ? demoPlot : queryPlot;

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
      data-testid="exception-detail-plot"
      className="flex font-body items-center justify-center w-full md:w-1/2 h-128"
    >
      {effectiveStatus === "pending" && <SkeletonPlot />}
      {effectiveStatus === "error" && (
        <p className="text-lg font-display text-center p-4">
          Error fetching plot, please change filters or refresh page to try
          again
        </p>
      )}
      {effectiveStatus === "success" && plot === null && (
        <p
          data-testid="exception-detail-plot-no-data"
          className="text-lg font-display text-center p-4"
        >
          No Data
        </p>
      )}
      {effectiveStatus === "success" && plot !== null && plot !== undefined && (
        <div data-testid="exception-detail-plot-data" className="size-full">
          <ResponsiveLineCanvas
            data={plot}
            curve="monotoneX"
            theme={canvasTheme}
            enableArea={true}
            areaOpacity={0.1}
            colors={chartColors}
            margin={{ top: 40, right: 60, bottom: 180, left: 50 }}
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
              tickRotation: 60,
              legendPosition: "middle",
            }}
            axisLeft={{
              tickSize: 1,
              tickPadding: 5,
              format: (value) =>
                Number.isInteger(value) ? numberToKMB(value) : "",
              legend: "Error instances",
              legendOffset: demo ? -45 : -40,
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
                        {sibling.y > 1 ? "instances" : "instance"}
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

export default ErrorsDetailsPlot;
