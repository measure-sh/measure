"use client";

import React, { useMemo, useState } from "react";
import {
  formatMillisToHumanReadable,
  PlotTimeGroup,
} from "../utils/time_utils";
import TabSelect from "./tab_select";
import TimeSeriesPlot, {
  DURATION_TICK_LABEL_WIDTH,
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
  startDate,
  endDate,
}) => {
  const [quantile, setQuantile] = useState(Quantile.p95);

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
          <TimeSeriesPlot
            data={plot}
            plotTimeGroup={plotTimeGroup}
            formatTick={formatDurationTick}
            tickLabelWidth={DURATION_TICK_LABEL_WIDTH}
            startDate={startDate}
            endDate={endDate}
            xAxisTitle="Date"
            yAxisTitle={`Duration (${quantile})`}
            formatTooltip={(_, datum) =>
              `${quantile}: ${formatMillisToHumanReadable(Number(datum.y))} (${datum.count.toLocaleString()} requests)`
            }
          />
        </div>
      </div>
    </div>
  );
};

export default NetworkLatencyPlot;
