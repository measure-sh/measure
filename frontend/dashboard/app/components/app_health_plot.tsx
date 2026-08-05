"use client";

import { useAppHealthPlotQuery } from "@/app/query/hooks";
import { useFiltersStore } from "@/app/stores/provider";
import { ResponsiveLineCanvas } from "@nivo/line";
import { DateTime } from "luxon";
import { useTheme } from "next-themes";
import React, { useMemo } from "react";
import { numberToKMB } from "../utils/number_utils";
import { useChartCanvasTheme, useChartColor } from "../utils/shared_styles";
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
const demoPlot = [
  {
    id: "Sessions",
    data: [
      { id: "s.1", x: demoDataDate.toFormat("yyyy-MM-dd"), y: 1720000 },
      {
        id: "s.2",
        x: demoDataDate.minus({ days: 1 }).toFormat("yyyy-MM-dd"),
        y: 1610000,
      },
      {
        id: "s.3",
        x: demoDataDate.minus({ days: 2 }).toFormat("yyyy-MM-dd"),
        y: 1580000,
      },
      {
        id: "s.4",
        x: demoDataDate.minus({ days: 3 }).toFormat("yyyy-MM-dd"),
        y: 1420000,
      },
      {
        id: "s.5",
        x: demoDataDate.minus({ days: 4 }).toFormat("yyyy-MM-dd"),
        y: 1350000,
      },
      {
        id: "s.6",
        x: demoDataDate.minus({ days: 5 }).toFormat("yyyy-MM-dd"),
        y: 1240000,
      },
      {
        id: "s.7",
        x: demoDataDate.minus({ days: 6 }).toFormat("yyyy-MM-dd"),
        y: 1080000,
      },
    ],
  },
  {
    id: "Crashes",
    data: [
      { id: "c.1", x: demoDataDate.toFormat("yyyy-MM-dd"), y: 15400 },
      {
        id: "c.2",
        x: demoDataDate.minus({ days: 1 }).toFormat("yyyy-MM-dd"),
        y: 14600,
      },
      {
        id: "c.3",
        x: demoDataDate.minus({ days: 2 }).toFormat("yyyy-MM-dd"),
        y: 14300,
      },
      {
        id: "c.4",
        x: demoDataDate.minus({ days: 3 }).toFormat("yyyy-MM-dd"),
        y: 12800,
      },
      {
        id: "c.5",
        x: demoDataDate.minus({ days: 4 }).toFormat("yyyy-MM-dd"),
        y: 12100,
      },
      {
        id: "c.6",
        x: demoDataDate.minus({ days: 5 }).toFormat("yyyy-MM-dd"),
        y: 11100,
      },
      {
        id: "c.7",
        x: demoDataDate.minus({ days: 6 }).toFormat("yyyy-MM-dd"),
        y: 9700,
      },
    ],
  },
  {
    id: "ANRs",
    data: [
      { id: "a.1", x: demoDataDate.toFormat("yyyy-MM-dd"), y: 5200 },
      {
        id: "a.2",
        x: demoDataDate.minus({ days: 1 }).toFormat("yyyy-MM-dd"),
        y: 4800,
      },
      {
        id: "a.3",
        x: demoDataDate.minus({ days: 2 }).toFormat("yyyy-MM-dd"),
        y: 4700,
      },
      {
        id: "a.4",
        x: demoDataDate.minus({ days: 3 }).toFormat("yyyy-MM-dd"),
        y: 4300,
      },
      {
        id: "a.5",
        x: demoDataDate.minus({ days: 4 }).toFormat("yyyy-MM-dd"),
        y: 4100,
      },
      {
        id: "a.6",
        x: demoDataDate.minus({ days: 5 }).toFormat("yyyy-MM-dd"),
        y: 3700,
      },
      {
        id: "a.7",
        x: demoDataDate.minus({ days: 6 }).toFormat("yyyy-MM-dd"),
        y: 3200,
      },
    ],
  },
];

interface AppHealthPlotProps {
  demo?: boolean;
}

const AppHealthPlot: React.FC<AppHealthPlotProps> = ({ demo = false }) => {
  const filters = useFiltersStore((state) => state.filters);
  const { data: queryPlot, status } = useAppHealthPlotQuery();
  const { theme } = useTheme();
  const chartColor = useChartColor();
  const plotTimeGroup = getPlotTimeGroupForRange(
    filters.startDate,
    filters.endDate,
  );
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup);

  const effectiveStatus = demo ? "success" : status;
  const rawPlot = demo ? demoPlot : queryPlot;

  const colorMap = useMemo(
    () =>
      ({
        Sessions: chartColor.blue,
        Crashes: chartColor.red,
        ANRs: chartColor.amber,
      }) as const,
    [chartColor],
  );

  const canvasTheme = useChartCanvasTheme();
  const plot = useMemo(() => {
    if (!rawPlot) {
      return rawPlot;
    }
    return embedSiblingPoints(
      rawPlot,
      (id) => colorMap[id as keyof typeof colorMap] || "#888",
    );
  }, [rawPlot, colorMap]);

  const labelMap = {
    Sessions: "Sessions",
    Crashes: "Crashes",
    ANRs: "ANRs",
  } as const;

  return (
    <div className="flex font-body items-center justify-center w-full h-96">
      {effectiveStatus === "pending" && <SkeletonPlot />}
      {effectiveStatus === "error" && (
        <p className="text-lg font-display text-center p-4">
          Error fetching plot, please change filters or refresh page to try
          again
        </p>
      )}
      {effectiveStatus === "success" && plot === null && (
        <p className="text-lg font-display text-center p-4">No Data</p>
      )}
      {effectiveStatus === "success" && plot !== null && plot !== undefined && (
        <div className="size-full">
          <ResponsiveLineCanvas
            data={plot}
            curve="monotoneX"
            theme={canvasTheme}
            enableArea={true}
            areaOpacity={0.05}
            colors={({ id }) => colorMap[id as keyof typeof colorMap] || "#888"}
            margin={{ top: 40, right: 40, bottom: 80, left: 40 }}
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
              tickPadding: 16,
              format: timeConfig.axisBottomFormat,
              legendPosition: "middle",
              tickRotation: 55,
            }}
            axisLeft={{
              tickSize: 1,
              tickPadding: 5,
              format: (value) =>
                Number.isInteger(value) ? numberToKMB(value) : "",
            }}
            pointSize={6}
            pointBorderWidth={1.5}
            pointColor={
              theme === "dark"
                ? "rgba(0, 0, 0, 255)"
                : "rgba(255, 255, 255, 255)"
            }
            pointBorderColor={({ seriesId }: { seriesId: string }) =>
              colorMap[seriesId as keyof typeof colorMap] || "#888"
            }
            enableGridX={false}
            enableGridY={false}
            tooltip={({ point }) => {
              const pointData = point.data as unknown as {
                xFormatted: string;
                siblings: SiblingPoint[];
              };
              const order = ["Sessions", "Crashes", "ANRs"] as const;
              const siblingsById: Record<string, SiblingPoint> =
                Object.fromEntries(pointData.siblings.map((s) => [s.id, s]));
              return (
                <PlotTooltipShell>
                  <p className="p-2">
                    Date:{" "}
                    {formatPlotTooltipDate(
                      pointData.xFormatted.toString(),
                      plotTimeGroup,
                    )}
                  </p>
                  {order.map((key) => {
                    const sibling = siblingsById[key];
                    if (!sibling) return null;
                    return (
                      <div className="flex flex-row items-center p-2" key={key}>
                        <PlotTooltipSwatch color={sibling.color} />
                        <div className="px-2" />
                        <p>{labelMap[key]} - </p>
                        <div className="px-2" />
                        <p>
                          {sibling.y.toLocaleString()} {labelMap[key]}
                        </p>
                      </div>
                    );
                  })}
                </PlotTooltipShell>
              );
            }}
          />
        </div>
      )}
    </div>
  );
};

export default AppHealthPlot;
