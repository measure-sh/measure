"use client";

import { Activity } from "lucide-react";
import { DateTime } from "luxon";
import React, { useMemo } from "react";
import { numberToKMB } from "../utils/number_utils";
import { useChartColor } from "../utils/chart_utils";
import { getPlotTimeGroupForRange } from "../utils/time_utils";
import EmptyState from "./empty_state";
import { SkeletonPlot } from "./skeleton";
import TimeSeriesPlot from "./time_series_plot";

export type AppHealthPlotData = {
  id: string;
  data: { id: string; x: string; y: number }[];
}[];

const demoDataDate = DateTime.now();
export const demoPlot: AppHealthPlotData = [
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
  status: "pending" | "success" | "error";
  plot: AppHealthPlotData | null | undefined;
  startDate: string;
  endDate: string;
}

const AppHealthPlot: React.FC<AppHealthPlotProps> = ({
  status,
  plot,
  startDate,
  endDate,
}) => {
  const chartColor = useChartColor();
  const plotTimeGroup = getPlotTimeGroupForRange(startDate, endDate);

  const colorMap = useMemo(
    () =>
      ({
        Sessions: chartColor.blue,
        Crashes: chartColor.red,
        ANRs: chartColor.amber,
      }) as const,
    [chartColor],
  );

  return (
    <div className="flex font-body items-center justify-center w-full h-96">
      {status === "pending" && <SkeletonPlot />}
      {status === "error" && (
        <p className="text-lg font-display text-center p-4">
          Error fetching plot, please change filters or refresh page to try
          again
        </p>
      )}
      {status === "success" && (plot === null || plot === undefined) && (
        <EmptyState
          icon={Activity}
          title="No sessions found"
          description="Try a wider time range or different filters"
          className="h-full"
        />
      )}
      {status === "success" && plot !== null && plot !== undefined && (
        <div className="size-full">
          <TimeSeriesPlot
            data={plot}
            plotTimeGroup={plotTimeGroup}
            formatTick={numberToKMB}
            startDate={startDate}
            endDate={endDate}
            showAllSeriesInTooltip
            integerTicks
            colors={(id) => colorMap[id as keyof typeof colorMap] || "#888"}
            formatTooltip={(seriesId, datum) =>
              `${seriesId} - ${Number(datum.y).toLocaleString()}`
            }
          />
        </div>
      )}
    </div>
  );
};

export default AppHealthPlot;
