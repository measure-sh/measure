"use client";

import { Timer } from "lucide-react";
import type { FunnelStepTracesResponse } from "../../api/api_calls";
import type { RootSpanMetricsQuantile } from "../../query/hooks";
import { urlFiltersKeyMap } from "../../stores/filters_store";
import {
  CountCell,
  DurationCells,
  OutcomeCells,
  StepList,
  type StepOutcomes,
  StepRow,
  useDateRangeParams,
} from "./step_list";
import { TableHead } from "../table";

export default function FunnelStepTraces({
  teamId,
  appId,
  status,
  data,
  error,
  isFetching,
  quantile,
  offset,
  outcomes,
  demo = false,
  onOpenItem,
}: {
  teamId: string;
  appId: string;
  status: "pending" | "success" | "error";
  data: FunnelStepTracesResponse | undefined;
  error?: unknown;
  isFetching?: boolean;
  quantile: RootSpanMetricsQuantile;
  offset: number;
  outcomes: StepOutcomes;
  demo?: boolean;
  onOpenItem?: () => void;
}) {
  const dateRangeParams = useDateRangeParams();

  const hrefOf = (spanName: string) => {
    if (demo) {
      return undefined;
    }
    const params = new URLSearchParams(dateRangeParams);
    params.set(urlFiltersKeyMap.appId, appId);
    params.set(urlFiltersKeyMap.rootSpanName, spanName);
    return `/${teamId}/traces?${params}`;
  };

  return (
    <StepList
      status={status}
      data={data}
      error={error}
      isFetching={isFetching}
      offset={offset}
      noun="traces"
      tableClassName="max-lg:min-w-190"
      icon={Timer}
      columns={6}
      header={
        <>
          <TableHead className="w-[38%]">Trace</TableHead>
          <TableHead className="w-[10%] text-center">Instances</TableHead>
          <TableHead className="w-[13%] text-center">
            Conversion Duration ({quantile})
          </TableHead>
          <TableHead className="w-[13%] text-center">
            Drop-off Duration ({quantile})
          </TableHead>
          <TableHead className="w-[13%] text-center">Conversions</TableHead>
          <TableHead className="w-[13%] text-right">Drop-offs</TableHead>
        </>
      }
    >
      {(trace) => {
        const href = hrefOf(trace.span_name);
        return (
          <StepRow
            key={trace.span_name}
            href={href}
            onOpen={onOpenItem}
            label={trace.span_name}
            titleClassName="w-[38%]"
            title={<p className="truncate">{trace.span_name}</p>}
          >
            <CountCell href={href} className="w-[10%]" count={trace.count} />
            <DurationCells
              href={href}
              className="w-[13%]"
              convertedMs={trace.converted_duration_ms}
              droppedMs={trace.dropped_duration_ms}
            />
            <OutcomeCells
              href={href}
              className="w-[13%]"
              item={trace}
              outcomes={outcomes}
            />
          </StepRow>
        );
      }}
    </StepList>
  );
}
