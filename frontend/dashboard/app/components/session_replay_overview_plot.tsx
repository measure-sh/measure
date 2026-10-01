"use client";

import { type useSessionReplayOverviewPlotQuery } from "@/app/query/hooks";
import { Video } from "lucide-react";
import React from "react";
import { numberToKMB } from "../utils/number_utils";
import { getPlotTimeGroupForRange } from "../utils/time_utils";
import EmptyState from "./empty_state";
import { SkeletonPlot } from "./skeleton";
import TimeSeriesPlot, { formatCount } from "./time_series_plot";

const SessionReplayOverviewPlot: React.FC<{
  startDate: string;
  endDate: string;
  query: ReturnType<typeof useSessionReplayOverviewPlotQuery>;
}> = ({ startDate, endDate, query }) => {
  const { data: plot, status } = query;
  const plotTimeGroup = getPlotTimeGroupForRange(startDate, endDate);

  return (
    <div
      data-testid="sessions-plot"
      className="flex font-body items-center justify-center w-full h-144"
    >
      {status === "pending" && <SkeletonPlot />}
      {status === "error" && (
        <p className="text-lg font-display text-center p-4">
          Error fetching plot, please change filters or refresh page to try
          again
        </p>
      )}
      {status === "success" && plot === null && (
        <div data-testid="sessions-plot-no-data" className="size-full">
          <EmptyState
            icon={Video}
            title="No sessions found"
            description="Try a wider time range or different filters"
            className="h-full"
          />
        </div>
      )}
      {status === "success" && plot !== null && plot !== undefined && (
        <div data-testid="sessions-plot-data" className="size-full">
          <TimeSeriesPlot
            data={plot}
            plotTimeGroup={plotTimeGroup}
            formatTick={numberToKMB}
            startDate={startDate}
            endDate={endDate}
            xAxisTitle="Date"
            yAxisTitle="Session Replay"
            integerTicks
            showAllSeriesInTooltip
            formatTooltip={(seriesId, datum) =>
              `${seriesId} - ${formatCount(Number(datum.y), "session replay", "session replays")}`
            }
          />
        </div>
      )}
    </div>
  );
};

export default SessionReplayOverviewPlot;
