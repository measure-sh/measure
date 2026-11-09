"use client";

import React, { useMemo } from "react";
import {
  formatMillisToHumanReadable,
  PlotTimeGroup,
} from "../utils/time_utils";
import TimeSeriesPlot, {
  DURATION_TICK_LABEL_WIDTH,
  formatCount,
  formatDurationTick,
} from "./time_series_plot";

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
  startDate?: string;
  endDate?: string;
  quantile: LatencyQuantile;
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

export enum LatencyQuantile {
  p50 = "p50",
  p90 = "p90",
  p95 = "p95",
  p99 = "p99",
}

const NetworkLatencyPlot: React.FC<NetworkLatencyPlotProps> = ({
  data,
  plotTimeGroup,
  startDate,
  endDate,
  quantile,
}) => {
  const plot = useMemo<PlotData>(() => {
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

  return (
    <div className="size-full font-body">
      <TimeSeriesPlot
        data={plot}
        plotTimeGroup={plotTimeGroup}
        formatTick={formatDurationTick}
        tickLabelWidth={DURATION_TICK_LABEL_WIDTH}
        startDate={startDate}
        endDate={endDate}
        formatTooltip={(_, datum) =>
          `${quantile}: ${formatMillisToHumanReadable(Number(datum.y))} (${formatCount(datum.count, "request", "requests")})`
        }
      />
    </div>
  );
};

export default NetworkLatencyPlot;
