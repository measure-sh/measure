"use client";

import {
  transformDevicesSessionsPlotData,
  type useDevicesSessionsPlotQuery,
} from "@/app/query/hooks";
import { Smartphone } from "lucide-react";
import { useMemo } from "react";
import { getPlotTimeGroupForRange } from "../../utils/time_utils";
import EmptyState from "../empty_state";
import { SkeletonPlot } from "../skeleton";
import TimeSeriesPlot, { formatCount } from "../time_series_plot";
import { numberToKMB } from "../../utils/number_utils";

export default function DevicesSessionsPlot({
  startDate,
  endDate,
  query,
}: {
  startDate: string;
  endDate: string;
  query: ReturnType<typeof useDevicesSessionsPlotQuery>;
}) {
  const { data: rawData, status } = query;
  const plotTimeGroup = getPlotTimeGroupForRange(startDate, endDate);
  const plot = useMemo(
    () => rawData && transformDevicesSessionsPlotData(rawData),
    [rawData],
  );

  return (
    <div className="flex items-center justify-center w-full h-64 2xl:h-96">
      {status === "pending" && <SkeletonPlot />}
      {status === "error" && (
        <p className="text-lg font-display text-center p-4">
          Error fetching plot, please change filters or refresh page to try
          again
        </p>
      )}
      {status === "success" && (!plot || plot.length === 0) && (
        <div data-testid="devices-sessions-plot-no-data" className="size-full">
          <EmptyState
            icon={Smartphone}
            title="No sessions found"
            description="Try a wider time range or different filters"
            className="h-full"
          />
        </div>
      )}
      {status === "success" && plot && plot.length > 0 && (
        <div data-testid="devices-sessions-plot-data" className="size-full">
          <TimeSeriesPlot
            data={plot}
            plotTimeGroup={plotTimeGroup}
            startDate={startDate}
            endDate={endDate}
            xAxisTitle="Date"
            yAxisTitle="Sessions"
            formatTick={numberToKMB}
            integerTicks
            showAllSeriesInTooltip
            formatTooltip={(seriesId, datum) =>
              `${seriesId} - ${formatCount(Number(datum.y), "session", "sessions")}`
            }
          />
        </div>
      )}
    </div>
  );
}
