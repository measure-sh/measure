"use client";

import { Globe } from "lucide-react";
import type { FunnelStepNetworkResponse } from "../../api/api_calls";
import type { RootSpanMetricsQuantile } from "../../query/hooks";
import { urlFiltersKeyMap } from "../../stores/filters_store";
import {
  CountCell,
  DurationCells,
  OutcomeCells,
  StepList,
  type StepOutcomes,
  type StepListQuery,
  StepRow,
  useDateRangeParams,
} from "./step_list";
import { TableHead } from "../table";

type StepEndpoint = FunnelStepNetworkResponse["results"][number];

export default function FunnelStepNetwork({
  teamId,
  appId,
  query,
  quantile,
  offset,
  outcomes,
  demo = false,
  onOpenItem,
}: {
  teamId: string;
  appId: string;
  query: StepListQuery<FunnelStepNetworkResponse>;
  quantile: RootSpanMetricsQuantile;
  offset: number;
  outcomes: StepOutcomes;
  demo?: boolean;
  onOpenItem?: () => void;
}) {
  const dateRangeParams = useDateRangeParams();

  const hrefOf = (endpoint: StepEndpoint) => {
    if (demo) {
      return undefined;
    }
    const params = new URLSearchParams(dateRangeParams);
    params.set(urlFiltersKeyMap.appId, appId);
    params.set("domain", endpoint.domain);
    params.set("path", endpoint.path_pattern);
    params.set("from", "funnel");
    return `/${teamId}/network/details?${params}`;
  };

  return (
    <StepList
      query={query}
      offset={offset}
      noun="network requests"
      icon={Globe}
      columns={6}
      header={
        <>
          <TableHead className="w-[38%]">Endpoint</TableHead>
          <TableHead className="w-[10%] text-center">Requests</TableHead>
          <TableHead className="w-[13%] text-center">
            Conversion Latency ({quantile})
          </TableHead>
          <TableHead className="w-[13%] text-center">
            Drop-off Latency ({quantile})
          </TableHead>
          <TableHead className="w-[13%] text-center">Conversions</TableHead>
          <TableHead className="w-[13%] text-center">Drop-offs</TableHead>
        </>
      }
    >
      {(endpoint) => {
        const name = `${endpoint.domain}${endpoint.path_pattern}`;
        const href = hrefOf(endpoint);
        return (
          <StepRow
            key={name}
            href={href}
            onOpen={onOpenItem}
            label={name}
            titleClassName="w-[38%] max-w-0"
            title={
              <p className="truncate font-mono" title={name}>
                {name}
              </p>
            }
          >
            <CountCell href={href} className="w-[10%]" count={endpoint.count} />
            <DurationCells
              href={href}
              className="w-[13%]"
              convertedMs={endpoint.converted_latency_ms}
              droppedMs={endpoint.dropped_latency_ms}
            />
            <OutcomeCells
              href={href}
              className="w-[13%]"
              item={endpoint}
              outcomes={outcomes}
            />
          </StepRow>
        );
      }}
    </StepList>
  );
}
