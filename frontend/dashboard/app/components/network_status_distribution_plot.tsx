"use client";

import React, { useMemo } from "react";
import { numberToKMB } from "../utils/number_utils";
import { useChartColor } from "../utils/chart_utils";
import { PlotTimeGroup } from "../utils/time_utils";
import TimeSeriesPlot, { formatCountWithShare } from "./time_series_plot";

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
  startDate?: string;
  endDate?: string;
}

type PlotData = {
  id: string;
  data: {
    x: string;
    y: number;
    total_count: number;
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
> = ({ data, plotTimeGroup, startDate, endDate }) => {
  const chartColor = useChartColor();

  const colorMap = {
    "2xx": chartColor.green,
    "3xx": chartColor.blue,
    "4xx": chartColor.amber,
    "5xx": chartColor.red,
  };

  const plot = useMemo<PlotData>(() => {
    return seriesConfig.map(({ key, id }) => ({
      id,
      data: data.map((d) => ({
        x: d.datetime,
        y: d[key],
        total_count: d.total_count,
      })),
    }));
  }, [data]);

  return (
    <div className="flex font-body items-center justify-center w-full h-144">
      <div className="size-full">
        <TimeSeriesPlot
          data={plot}
          plotTimeGroup={plotTimeGroup}
          formatTick={numberToKMB}
          startDate={startDate}
          endDate={endDate}
          xAxisTitle="Date"
          yAxisTitle="Requests"
          integerTicks
          colors={(id) => colorMap[id as keyof typeof colorMap] || "#888"}
          showAllSeriesInTooltip
          formatTooltip={(seriesId, datum) =>
            `${seriesId}: ${formatCountWithShare(Number(datum.y), datum.total_count)}`
          }
          tooltipTotal={(datum) => datum.total_count}
        />
      </div>
    </div>
  );
};

export default NetworkStatusDistributionPlot;
