"use client";

import React, { useMemo } from "react";
import { numberToKMB } from "../utils/number_utils";
import { useChartColor } from "../utils/chart_utils";
import { PlotTimeGroup } from "../utils/time_utils";
import TimeSeriesPlot, { formatCountWithShare } from "./time_series_plot";

interface StatusCodeDataPoint {
  datetime: string;
  total_count: number;
  [key: string]: number | string;
}

interface NetworkEndpointStatusCodesPlotProps {
  statusCodes: number[];
  data: StatusCodeDataPoint[];
  plotTimeGroup: PlotTimeGroup;
  startDate?: string;
  endDate?: string;
}

const statusCodeCount = (dataPoint: StatusCodeDataPoint, code: number) => {
  const count = dataPoint[`count_${code}`];
  return typeof count === "number" ? count : 0;
};

const NetworkEndpointStatusCodesPlot: React.FC<
  NetworkEndpointStatusCodesPlotProps
> = ({ statusCodes, data, plotTimeGroup, startDate, endDate }) => {
  const chartColor = useChartColor();

  const bucketColors: Record<number, string> = {
    2: chartColor.green,
    3: chartColor.blue,
    4: chartColor.amber,
    5: chartColor.red,
  };
  const statusCodeColor = (code: number) =>
    bucketColors[Math.floor(code / 100)] || "#888";

  const plot = useMemo(() => {
    return statusCodes.map((code) => ({
      id: String(code),
      data: data.map((dataPoint) => ({
        x: dataPoint.datetime,
        y: statusCodeCount(dataPoint, code),
        total_count: dataPoint.total_count,
      })),
    }));
  }, [data, statusCodes]);

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
          colors={(id) => statusCodeColor(Number(id))}
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

export default NetworkEndpointStatusCodesPlot;
