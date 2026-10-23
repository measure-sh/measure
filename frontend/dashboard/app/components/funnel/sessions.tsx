"use client";

import { Video } from "lucide-react";
import { useState } from "react";
import type { FunnelConversion, FunnelStepOutcome } from "../../api/api_calls";
import {
  type FilterParams,
  FUNNEL_STEP_LIST_LIMIT,
  useFunnelStepSessionsQuery,
} from "../../query/hooks";
import {
  formatDateToHumanReadableDate,
  formatDateToHumanReadableTime,
  formatMillisToHumanReadable,
} from "../../utils/time_utils";
import { ControlSeparator, StepPairSelect } from "./friction";
import { StepList, StepRow } from "./step_list";
import InfoTooltip from "../info_tooltip";
import Paginator from "../paginator";
import RowLinkCell from "../row_link_cell";
import { Skeleton, SkeletonTable } from "../skeleton";
import TabSelect from "../tab_select";
import { TableHead } from "../table";

export enum SessionsOutcome {
  Dropped = "Dropped off",
  Converted = "Converted",
}

export const outcomeParams: Record<SessionsOutcome, FunnelStepOutcome> = {
  [SessionsOutcome.Dropped]: "dropped",
  [SessionsOutcome.Converted]: "converted",
};

interface SessionListProps {
  teamId: string;
  funnelId: string;
  params: FilterParams;
  conversion: FunnelConversion;
  // The step users move into, from 1 to the last step, or null for the
  // whole funnel.
  selectedStep: number | null;
  onSelectStep: (step: number | null) => void;
  outcome: SessionsOutcome;
  onSelectOutcome: (outcome: SessionsOutcome) => void;
  onOpenSession: () => void;
}

function SessionList({
  teamId,
  funnelId,
  params,
  conversion,
  selectedStep,
  onSelectStep,
  outcome,
  onSelectOutcome,
  onOpenSession,
}: SessionListProps) {
  const [offset, setOffset] = useState(0);
  const query = useFunnelStepSessionsQuery(
    params,
    funnelId,
    selectedStep,
    outcomeParams[outcome],
    offset,
  );

  return (
    <>
      <div className="flex w-full flex-wrap items-center justify-between gap-4">
        <StepPairSelect
          conversion={conversion}
          selectedStep={selectedStep}
          onSelectStep={onSelectStep}
        />
        <div className="flex items-center gap-2">
          <Paginator
            size="sm"
            displayText=""
            prevEnabled={
              !query.isFetching && (query.data?.meta.previous ?? false)
            }
            nextEnabled={!query.isFetching && (query.data?.meta.next ?? false)}
            onNext={() => setOffset((o) => o + FUNNEL_STEP_LIST_LIMIT)}
            onPrev={() =>
              setOffset((o) => Math.max(0, o - FUNNEL_STEP_LIST_LIMIT))
            }
          />
          <ControlSeparator />
          <TabSelect
            items={Object.values(SessionsOutcome)}
            selected={outcome}
            onChangeSelected={(item) => {
              onSelectOutcome(item as SessionsOutcome);
              setOffset(0);
            }}
          />
        </div>
      </div>
      <StepList
        query={query}
        offset={offset}
        noun="session replays"
        icon={Video}
        columns={3}
        header={
          <>
            <TableHead className="w-[60%]">User ID / Installation ID</TableHead>
            <TableHead className="w-[20%] text-center">Start Time</TableHead>
            <TableHead className="w-[20%] text-center">Duration</TableHead>
          </>
        }
      >
        {(session) => {
          const href = `/${teamId}/session_replays/${params.appId}/${session.session_id}?from=funnel_details`;
          return (
            <StepRow
              key={session.session_id}
              href={href}
              onOpen={onOpenSession}
              label={`Session ID: ${session.session_id}`}
              titleClassName="w-[60%] max-w-0"
              title={
                session.user_id ? (
                  <>
                    <p className="truncate">{session.user_id}</p>
                    <div className="py-1" />
                    <p className="text-xs truncate text-muted-foreground">
                      {session.installation_id}
                    </p>
                  </>
                ) : (
                  <p className="truncate">{session.installation_id}</p>
                )
              }
            >
              <RowLinkCell href={href} className="w-[20%] text-center">
                <p className="truncate">
                  {formatDateToHumanReadableDate(session.first_event_time)}
                </p>
                <div className="py-1" />
                <p className="text-xs truncate">
                  {formatDateToHumanReadableTime(session.first_event_time)}
                </p>
              </RowLinkCell>
              <RowLinkCell href={href} className="w-[20%] text-center">
                {session.duration === 0
                  ? "N/A"
                  : formatMillisToHumanReadable(session.duration)}
              </RowLinkCell>
            </StepRow>
          );
        }}
      </StepList>
    </>
  );
}

export default function FunnelSessions({
  params,
  conversion,
  conversionFailed,
  selectedStep,
  ...rest
}: Omit<SessionListProps, "params" | "conversion"> & {
  params: FilterParams | null;
  conversion: FunnelConversion | undefined;
  conversionFailed: boolean;
}) {
  return (
    <div className="w-full font-body">
      <div className="flex items-center gap-2">
        <p className="font-display text-xl">Session Replays</p>
        <InfoTooltip content="Sessions of users who did the first of the selected steps, from that step until they did the last one or their conversion window ran out. One user can have several sessions." />
      </div>
      <div className="py-2" />
      {conversionFailed ? (
        <p className="text-sm">
          Error fetching session replays, please change filters or refresh page
          to try again
        </p>
      ) : params === null || conversion === undefined ? (
        <>
          <Skeleton className="h-9 w-80" />
          <div className="py-4" />
          <SkeletonTable rows={5} columns={3} />
        </>
      ) : (
        // The key remounts the list when the step or filters change, so it
        // goes back to its first page.
        <SessionList
          key={[
            selectedStep,
            params.startDate,
            params.endDate,
            params.filterExpr,
          ].join("|")}
          params={params}
          conversion={conversion}
          selectedStep={selectedStep}
          {...rest}
        />
      )}
    </div>
  );
}
