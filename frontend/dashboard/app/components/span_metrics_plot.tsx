"use client";

import {
  RootSpanMetricsQuantile,
  transformSpanMetricsPlotData,
  type useSpanMetricsPlotQuery,
} from "@/app/query/hooks";
import { ChartGantt } from "lucide-react";
import React, { useMemo, useState } from "react";
import {
  formatMillisToHumanReadable,
  getPlotTimeGroupForRange,
} from "../utils/time_utils";
import EmptyState from "./empty_state";
import { SkeletonPlot } from "./skeleton";
import TabSelect from "./tab_select";
import TimeSeriesPlot, {
  DURATION_TICK_LABEL_WIDTH,
  formatDurationTick,
} from "./time_series_plot";

const SpanMetricsPlot: React.FC<{
  startDate: string;
  endDate: string;
  query: ReturnType<typeof useSpanMetricsPlotQuery>;
}> = ({ startDate, endDate, query }) => {
  const [quantile, setQuantile] = useState<RootSpanMetricsQuantile>(
    RootSpanMetricsQuantile.p50,
  );
  const { data: rawData, status } = query;
  const plotTimeGroup = getPlotTimeGroupForRange(startDate, endDate);

  const plot = useMemo(
    () => rawData && transformSpanMetricsPlotData(rawData, quantile),
    [rawData, quantile],
  );

  function mapQuantileStringToQuantile(quantile: string) {
    switch (quantile) {
      case RootSpanMetricsQuantile.p50:
        return RootSpanMetricsQuantile.p50;
      case RootSpanMetricsQuantile.p90:
        return RootSpanMetricsQuantile.p90;
      case RootSpanMetricsQuantile.p95:
        return RootSpanMetricsQuantile.p95;
      case RootSpanMetricsQuantile.p99:
        return RootSpanMetricsQuantile.p99;
    }

    throw "Invalid quantile selected";
  }

  return (
    <div className="flex font-body items-center justify-center w-full h-144">
      {status === "pending" && <SkeletonPlot />}
      {status === "error" && (
        <p className="text-lg font-display text-center p-4">
          Error fetching plot, please change filters or refresh page to try
          again
        </p>
      )}
      {status === "success" && plot === null && (
        <EmptyState
          icon={ChartGantt}
          title="No traces found"
          description="Try a wider time range or different filters"
          className="h-full"
        />
      )}
      {status === "success" && plot !== null && plot !== undefined && (
        <div className="flex flex-col w-full h-full">
          <div className="flex flex-col w-full items-end p-2">
            <TabSelect
              items={Object.values(RootSpanMetricsQuantile)}
              selected={quantile}
              onChangeSelected={(item) =>
                setQuantile(mapQuantileStringToQuantile(item as string))
              }
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
              showAllSeriesInTooltip
              formatTooltip={(seriesId, datum) =>
                `${seriesId} - ${formatMillisToHumanReadable(Number(datum.y))} (${quantile})`
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SpanMetricsPlot;
