"use client";

import {
  MemoryUsageQuantile,
  transformMemoryUsagePlotData,
  type useMemoryUsagePlotQuery,
} from "@/app/query/hooks";
import { MemoryStick } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMemoryKilobytes } from "../utils/number_utils";
import { getPlotTimeGroupForRange } from "../utils/time_utils";
import EmptyState from "./empty_state";
import { SkeletonPlot } from "./skeleton";
import TabSelect from "./tab_select";
import TimeSeriesPlot from "./time_series_plot";

// Fits a memory label like "512.0 MB".
const MEMORY_TICK_LABEL_WIDTH = 46;

export default function MemoryUsagePlot({
  startDate,
  endDate,
  query,
}: {
  startDate: string;
  endDate: string;
  query: ReturnType<typeof useMemoryUsagePlotQuery>;
}) {
  const [quantile, setQuantile] = useState(MemoryUsageQuantile.p90);
  const { data: rawData, status } = query;
  const plotTimeGroup = getPlotTimeGroupForRange(startDate, endDate);
  const plot = useMemo(
    () => rawData && transformMemoryUsagePlotData(rawData, quantile),
    [rawData, quantile],
  );

  return (
    <section className="w-full font-body">
      <p className="font-display text-xl">Memory Usage</p>
      <div className="py-2" />
      <div className="flex items-center justify-center w-full h-144">
        {status === "pending" && <SkeletonPlot />}
        {status === "error" && (
          <p className="text-lg font-display text-center p-4">
            Error fetching plot, please change filters or refresh page to try
            again
          </p>
        )}
        {status === "success" && (!plot || plot.length === 0) && (
          <div data-testid="memory-usage-plot-no-data" className="size-full">
            <EmptyState
              icon={MemoryStick}
              title="No memory usage found"
              description="Try a wider time range or different filters"
              className="h-full"
            />
          </div>
        )}
        {status === "success" && plot && plot.length > 0 && (
          <div
            data-testid="memory-usage-plot-data"
            className="flex flex-col w-full h-full"
          >
            <div className="flex justify-end p-2">
              <TabSelect
                items={Object.values(MemoryUsageQuantile)}
                selected={quantile}
                onChangeSelected={(item) =>
                  setQuantile(item as MemoryUsageQuantile)
                }
              />
            </div>
            <div className="flex-1 min-h-0">
              <TimeSeriesPlot
                data={plot}
                plotTimeGroup={plotTimeGroup}
                startDate={startDate}
                endDate={endDate}
                xAxisTitle="Date"
                yAxisTitle="Memory usage"
                formatTick={formatMemoryKilobytes}
                tickLabelWidth={MEMORY_TICK_LABEL_WIDTH}
                showAllSeriesInTooltip
                formatTooltip={(seriesId, datum) =>
                  `${seriesId} - ${formatMemoryKilobytes(Number(datum.y))}`
                }
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
