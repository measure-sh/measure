"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import type {
  FunnelConversion,
  FunnelStepErrorsResponse,
  FunnelStepNetworkResponse,
  FunnelStepTracesResponse,
} from "../../api/api_calls";
import {
  type FilterParams,
  FUNNEL_STEP_LIST_LIMIT,
  RootSpanMetricsQuantile,
  useFunnelStepErrorsQuery,
  useFunnelStepNetworkQuery,
  useFunnelStepTracesQuery,
} from "../../query/hooks";
import { formatShare } from "./format";
import { useStepColor } from "./step_color";
import type { StepListQuery } from "./step_list";
import { numberToKMB } from "../../utils/number_utils";
import { Button } from "../button";
import { Command, CommandGroup, CommandItem } from "../command";
import type { FrictionItemTarget } from "./analytics";
import FunnelStepErrors from "./step_errors";
import FunnelStepNetwork from "./step_network";
import FunnelStepTraces from "./step_traces";
import InfoTooltip from "../info_tooltip";
import Paginator from "../paginator";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Separator } from "../separator";
import { Skeleton, SkeletonTable } from "../skeleton";
import TabSelect from "../tab_select";

export enum FrictionList {
  Errors = "Errors",
  Traces = "Traces",
  Network = "Network",
}

export function ControlSeparator() {
  return (
    <Separator
      orientation="vertical"
      className="data-[orientation=vertical]:h-6"
    />
  );
}

// The indexes of the steps users move from and to. A null step covers the
// whole funnel.
function stepRange(
  conversion: FunnelConversion,
  step: number | null,
): { from: number; to: number } {
  return step === null
    ? { from: 0, to: conversion.steps.length - 1 }
    : { from: step - 1, to: step };
}

function StepPair({
  conversion,
  step,
}: {
  conversion: FunnelConversion;
  step: number | null;
}) {
  const colorOf = useStepColor();
  if (step === null) {
    return (
      <span className="flex items-center gap-2 min-w-0">
        <span className="size-2 shrink-0 rounded-full bg-foreground" />
        <span className="truncate">Overall</span>
      </span>
    );
  }
  const event = (index: number) => (
    <>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: colorOf(index) }}
      />
      <span className="truncate">{conversion.steps[index].event_name}</span>
    </>
  );
  return (
    <span className="flex items-center gap-2 min-w-0">
      {event(step - 1)}
      <span className="text-muted-foreground">→</span>
      {event(step)}
    </span>
  );
}

export function StepPairSelect({
  conversion,
  selectedStep,
  onSelectStep,
}: {
  conversion: FunnelConversion;
  selectedStep: number | null;
  onSelectStep: (step: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { steps } = conversion;
  const options = [null, ...steps.slice(1).map((_, i) => i + 1)];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex justify-between w-fit min-w-0 max-w-full select-none font-display"
        >
          <StepPair conversion={conversion} step={selectedStep} />
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-auto min-w-80" align="start">
        <Command>
          <CommandGroup className="max-h-72 overflow-auto">
            {options.map((step) => {
              const { from, to } = stepRange(conversion, step);
              const reached = steps[from].users;
              const dropped = reached - steps[to].users;
              return (
                <CommandItem
                  key={step ?? "overall"}
                  value={String(step ?? "overall")}
                  onSelect={() => {
                    onSelectStep(step);
                    setOpen(false);
                  }}
                  className="flex items-center gap-4 font-display text-sm"
                >
                  <StepPair conversion={conversion} step={step} />
                  <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                    {numberToKMB(dropped)} dropped ·{" "}
                    {formatShare(dropped, reached)}
                  </span>
                  <Check
                    className={`h-4 w-4 shrink-0 ${step === selectedStep ? "" : "invisible"}`}
                  />
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface StepSelection {
  conversion: FunnelConversion;
  // The step users move into, from 1 to the last step, or null for the
  // whole funnel.
  selectedStep: number | null;
  onSelectStep: (step: number | null) => void;
  list: FrictionList;
  onSelectList: (list: FrictionList) => void;
}

type FrictionListsViewProps = StepSelection & {
  teamId: string;
  appId: string;
  demo?: boolean;
  onOpenItem?: (target: FrictionItemTarget) => void;
  quantile: RootSpanMetricsQuantile;
  onSelectQuantile: (quantile: RootSpanMetricsQuantile) => void;
  errorsQuery: StepListQuery<FunnelStepErrorsResponse>;
  tracesQuery: StepListQuery<FunnelStepTracesResponse>;
  networkQuery: StepListQuery<FunnelStepNetworkResponse>;
  offsets: Record<FrictionList, number>;
  onChangeOffset: (list: FrictionList, offset: number) => void;
};

export function FrictionListsView({
  teamId,
  appId,
  demo = false,
  conversion,
  selectedStep,
  onSelectStep,
  list,
  onSelectList,
  quantile,
  onSelectQuantile,
  errorsQuery,
  tracesQuery,
  networkQuery,
  offsets,
  onChangeOffset,
  onOpenItem,
}: FrictionListsViewProps) {
  const { from, to } = stepRange(conversion, selectedStep);
  const converted = conversion.steps[to].users;
  const outcomes = {
    converted,
    dropped: conversion.steps[from].users - converted,
  };

  const activeQuery = {
    [FrictionList.Errors]: errorsQuery,
    [FrictionList.Traces]: tracesQuery,
    [FrictionList.Network]: networkQuery,
  }[list];
  const offset = offsets[list];

  return (
    <>
      <div className="flex w-full flex-wrap items-center justify-between gap-4">
        <StepPairSelect
          conversion={conversion}
          selectedStep={selectedStep}
          onSelectStep={onSelectStep}
        />
        <div className="flex items-center gap-2">
          {list !== FrictionList.Errors && (
            <>
              <TabSelect
                items={Object.values(RootSpanMetricsQuantile)}
                selected={quantile}
                onChangeSelected={(item) => {
                  onSelectQuantile(item as RootSpanMetricsQuantile);
                  onChangeOffset(FrictionList.Traces, 0);
                  onChangeOffset(FrictionList.Network, 0);
                }}
              />
              <ControlSeparator />
            </>
          )}
          <Paginator
            size="sm"
            displayText=""
            prevEnabled={
              !activeQuery.isFetching &&
              (activeQuery.data?.meta.previous ?? false)
            }
            nextEnabled={
              !activeQuery.isFetching && (activeQuery.data?.meta.next ?? false)
            }
            onNext={() => onChangeOffset(list, offset + FUNNEL_STEP_LIST_LIMIT)}
            onPrev={() =>
              onChangeOffset(list, Math.max(0, offset - FUNNEL_STEP_LIST_LIMIT))
            }
          />
          <ControlSeparator />
          <TabSelect
            items={Object.values(FrictionList)}
            selected={list}
            onChangeSelected={(item) => onSelectList(item as FrictionList)}
          />
        </div>
      </div>
      {/* Lists stay mounted so switching back to a list opened before shows
          it straight away, without a loading skeleton that changes the page
          height. */}
      <div className={list === FrictionList.Errors ? "" : "hidden"}>
        <FunnelStepErrors
          teamId={teamId}
          appId={appId}
          query={errorsQuery}
          offset={offsets[FrictionList.Errors]}
          outcomes={outcomes}
          demo={demo}
          onOpenItem={() => onOpenItem?.("error")}
        />
      </div>
      <div className={list === FrictionList.Traces ? "" : "hidden"}>
        <FunnelStepTraces
          teamId={teamId}
          appId={appId}
          query={tracesQuery}
          quantile={quantile}
          offset={offsets[FrictionList.Traces]}
          outcomes={outcomes}
          demo={demo}
          onOpenItem={() => onOpenItem?.("trace")}
        />
      </div>
      <div className={list === FrictionList.Network ? "" : "hidden"}>
        <FunnelStepNetwork
          teamId={teamId}
          appId={appId}
          query={networkQuery}
          quantile={quantile}
          offset={offsets[FrictionList.Network]}
          outcomes={outcomes}
          demo={demo}
          onOpenItem={() => onOpenItem?.("network")}
        />
      </div>
    </>
  );
}

interface FrictionListsProps extends StepSelection {
  teamId: string;
  funnelId: string;
  params: FilterParams;
  onOpenItem: (target: FrictionItemTarget) => void;
}

export const FRICTION_FIRST_PAGES = {
  [FrictionList.Errors]: 0,
  [FrictionList.Traces]: 0,
  [FrictionList.Network]: 0,
};

function FrictionLists({
  funnelId,
  params,
  selectedStep,
  quantile,
  onSelectQuantile,
  ...rest
}: FrictionListsProps & {
  quantile: RootSpanMetricsQuantile;
  onSelectQuantile: (quantile: RootSpanMetricsQuantile) => void;
}) {
  const [offsets, setOffsets] = useState(FRICTION_FIRST_PAGES);
  // Each list's query is expensive, so a list is fetched only once the user
  // has opened it.
  const [openedLists, setOpenedLists] = useState(() => new Set([rest.list]));
  const opened = (list: FrictionList) =>
    list === rest.list || openedLists.has(list);
  const errorsQuery = useFunnelStepErrorsQuery(
    params,
    funnelId,
    selectedStep,
    offsets[FrictionList.Errors],
    opened(FrictionList.Errors),
  );
  const tracesQuery = useFunnelStepTracesQuery(
    params,
    funnelId,
    selectedStep,
    quantile,
    offsets[FrictionList.Traces],
    opened(FrictionList.Traces),
  );
  const networkQuery = useFunnelStepNetworkQuery(
    params,
    funnelId,
    selectedStep,
    quantile,
    offsets[FrictionList.Network],
    opened(FrictionList.Network),
  );

  return (
    <FrictionListsView
      appId={params.appId}
      selectedStep={selectedStep}
      quantile={quantile}
      onSelectQuantile={onSelectQuantile}
      errorsQuery={errorsQuery}
      tracesQuery={tracesQuery}
      networkQuery={networkQuery}
      offsets={offsets}
      onChangeOffset={(list, offset) =>
        setOffsets((offsets) => ({ ...offsets, [list]: offset }))
      }
      {...rest}
      onSelectList={(list) => {
        setOpenedLists((lists) => new Set(lists).add(list));
        rest.onSelectList(list);
      }}
    />
  );
}

export function FrictionHeading() {
  return (
    <>
      <div className="flex items-center gap-2">
        <p className="font-display text-xl">Friction</p>
        <InfoTooltip content="Errors, traces and network requests between the selected steps that can cause users to drop off." />
      </div>
      <div className="py-2" />
    </>
  );
}

export default function FunnelFriction({
  params,
  conversion,
  conversionFailed,
  selectedStep,
  ...rest
}: Omit<FrictionListsProps, "params" | "conversion"> & {
  params: FilterParams | null;
  conversion: FunnelConversion | undefined;
  conversionFailed: boolean;
}) {
  // The lists remount when the step or filters change, so the percentile is
  // kept here to stay the same across those changes. Traces and network
  // requests share it.
  const [quantile, setQuantile] = useState(RootSpanMetricsQuantile.p50);

  return (
    <div className="w-full font-body">
      <FrictionHeading />
      {conversionFailed ? (
        <p className="text-sm">
          Error fetching friction, please change filters or refresh page to try
          again
        </p>
      ) : params === null || conversion === undefined ? (
        <>
          <Skeleton className="h-9 w-80" />
          <div className="py-4" />
          <SkeletonTable rows={5} columns={5} />
        </>
      ) : (
        // The key remounts the lists when the step or filters change, so
        // they go back to their first page.
        <FrictionLists
          key={[
            selectedStep,
            params.startDate,
            params.endDate,
            params.filterExpr,
          ].join("|")}
          params={params}
          conversion={conversion}
          selectedStep={selectedStep}
          quantile={quantile}
          onSelectQuantile={setQuantile}
          {...rest}
        />
      )}
    </div>
  );
}
