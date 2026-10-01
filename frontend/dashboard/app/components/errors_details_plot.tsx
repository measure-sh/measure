"use client";

import { type useErrorsDetailsPlotQuery } from "@/app/query/hooks";
import { ChartLine } from "lucide-react";
import { DateTime } from "luxon";
import React from "react";
import { numberToKMB } from "../utils/number_utils";
import { getPlotTimeGroupForRange } from "../utils/time_utils";
import EmptyState from "./empty_state";
import { SkeletonPlot } from "./skeleton";
import TimeSeriesPlot, { formatCount } from "./time_series_plot";

const demoDataDate = DateTime.now();
const demoData = [
  {
    id: "1.0.0 (100)",
    data: [
      { datetime: demoDataDate.toFormat("yyyy-MM-dd"), instances: 1796 },
      {
        datetime: demoDataDate.minus({ days: 1 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 2 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 3 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 4 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 5 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 6 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
    ],
  },
  {
    id: "2.0.0 (200)",
    data: [
      { datetime: demoDataDate.toFormat("yyyy-MM-dd"), instances: 2204 },
      {
        datetime: demoDataDate.minus({ days: 1 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 2 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 3 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 4 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 5 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
      {
        datetime: demoDataDate.minus({ days: 6 }).toFormat("yyyy-MM-dd"),
        instances: 0,
      },
    ],
  },
];

interface ErrorsDetailsPlotProps {
  startDate: string;
  endDate: string;
  query?: ReturnType<typeof useErrorsDetailsPlotQuery>;
  demo?: boolean;
}

type ErrorsDetailsPlotData = {
  id: string;
  data: {
    x: string;
    y: number;
  }[];
}[];

const demoPlot: ErrorsDetailsPlotData = demoData.map((item: any) => ({
  id: item.id,
  data: item.data.map((d: any) => ({ x: d.datetime, y: d.instances })),
}));

const ErrorsDetailsPlot: React.FC<ErrorsDetailsPlotProps> = ({
  startDate,
  endDate,
  query,
  demo = false,
}) => {
  const plotTimeGroup = getPlotTimeGroupForRange(startDate, endDate);
  const effectiveStatus = demo ? "success" : (query?.status ?? "pending");
  const plot = demo ? demoPlot : query?.data;

  return (
    <div
      data-testid="exception-detail-plot"
      className="flex font-body items-center justify-center w-full md:w-1/2 h-128"
    >
      {effectiveStatus === "pending" && <SkeletonPlot />}
      {effectiveStatus === "error" && (
        <p className="text-lg font-display text-center p-4">
          Error fetching plot, please change filters or refresh page to try
          again
        </p>
      )}
      {effectiveStatus === "success" && plot === null && (
        <div
          data-testid="exception-detail-plot-no-data"
          className="size-full pb-2 md:pb-0 md:pr-2"
        >
          <EmptyState
            icon={ChartLine}
            title="No instances found"
            description="Try a wider time range or different filters"
            className="h-full"
          />
        </div>
      )}
      {effectiveStatus === "success" && plot !== null && plot !== undefined && (
        <div
          data-testid="exception-detail-plot-data"
          className="size-full pt-6 pb-[79px]"
        >
          <TimeSeriesPlot
            data={plot}
            plotTimeGroup={plotTimeGroup}
            formatTick={numberToKMB}
            startDate={startDate}
            endDate={endDate}
            xAxisTitle="Date"
            yAxisTitle="Error instances"
            integerTicks
            xTickRotation={60}
            showAllSeriesInTooltip
            formatTooltip={(seriesId, datum) =>
              `${seriesId} - ${formatCount(Number(datum.y), "instance", "instances")}`
            }
          />
        </div>
      )}
    </div>
  );
};

export default ErrorsDetailsPlot;
