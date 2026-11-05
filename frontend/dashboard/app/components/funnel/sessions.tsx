"use client";

import { Video } from "lucide-react";
import { useEffect } from "react";
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
import { pastLastPage } from "../../utils/url_utils";

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
  offset: number;
  onChangeOffset: (offset: number) => void;
  onPastLastPage: () => void;
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
  offset,
  onChangeOffset,
  onPastLastPage,
}: SessionListProps) {
  const query = useFunnelStepSessionsQuery(
    params,
    conversion.sample_percent,
    funnelId,
    selectedStep,
    outcomeParams[outcome],
    offset,
  );

  // Runs after every render while the list is past its last page, since the
  // page can skip the removal until its URL settles.
  useEffect(() => {
    if (pastLastPage(offset, query)) {
      onPastLastPage();
    }
  });

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
            onNext={() => onChangeOffset(offset + FUNNEL_STEP_LIST_LIMIT)}
            onPrev={() =>
              onChangeOffset(Math.max(0, offset - FUNNEL_STEP_LIST_LIMIT))
            }
          />
          <ControlSeparator />
          <TabSelect
            items={Object.values(SessionsOutcome)}
            selected={outcome}
            onChangeSelected={(item) =>
              onSelectOutcome(item as SessionsOutcome)
            }
          />
        </div>
      </div>
      <StepList
        status={query.status}
        data={query.data}
        error={query.error}
        isFetching={query.isFetching}
        offset={offset}
        noun="session replays"
        tableClassName="max-lg:min-w-140"
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
        // does not show the sessions of the previous step or filters while
        // the new ones load.
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
