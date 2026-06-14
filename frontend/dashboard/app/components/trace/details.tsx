"use client";

import { buttonVariants } from "@/app/components/button_variants";
import { Skeleton } from "@/app/components/skeleton";
import TraceWaterfall from "@/app/components/trace/waterfall";
import { useTraceQuery } from "@/app/query/hooks";
import { cn } from "@/app/utils/shadcn_utils";
import {
  formatDateToHumanReadableDateTime,
  formatMillisToHumanReadable,
} from "@/app/utils/time_utils";
import Link from "next/link";
import Pill, { PillType } from "../pill";
import { demoTrace } from "./demo_trace";
import { Span, Trace } from "./model";

interface TraceDetailsProps {
  params?: { teamId: string; appId: string; traceId: string };
  demo?: boolean;
  hideDemoTitle?: boolean;
}

export default function TraceDetails({
  params = {
    teamId: "demo-team-id",
    appId: "demo-app-id",
    traceId: "demo-trace-id",
  },
  demo = false,
  hideDemoTitle = false,
}: TraceDetailsProps) {
  const { data: trace, status: traceStatus } = useTraceQuery(
    demo ? "" : params.appId,
    demo ? "" : params.traceId,
  );

  const displayTrace = demo ? demoTrace : trace;
  const displayStatus = demo ? "success" : traceStatus;

  return (
    <div className="flex flex-col items-start">
      <p className="font-display text-4xl">
        {demo ? (hideDemoTitle ? "" : "Performance Traces") : ""}
      </p>
      <div className="py-2" />

      {displayStatus === "pending" && (
        <div className="flex flex-col w-full py-4">
          {/* Pills */}
          <div className="flex flex-wrap gap-2 py-2 pb-8">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          {/* Trace visualization */}
          <Skeleton className="h-[300px] w-full rounded-lg" />
          {/* Button */}
          <div className="py-4" />
          <Skeleton className="h-9 w-44" />
        </div>
      )}

      {displayStatus === "error" && (
        <p className="font-body text-sm">
          Error fetching trace, please refresh page to try again
        </p>
      )}

      {displayStatus === "success" && (
        <div className="w-full">
          <div className="flex flex-wrap gap-2 py-2 pb-8 items-center">
            {(() => {
              const root = (displayTrace as Trace).spans?.find(
                (s: Span) => s.parent_id === "",
              );
              if (!root) {
                return null;
              }
              const type =
                root.status === 1
                  ? PillType.StatusOkay
                  : root.status === 2
                    ? PillType.StatusError
                    : PillType.StatusUnset;
              return <Pill type={type} />;
            })()}
            <Pill
              tooltip
            >{`User ID: ${displayTrace.user_id !== "" ? displayTrace.user_id : "N/A"}`}</Pill>
            <Pill
              tooltip
            >{`Start Time: ${formatDateToHumanReadableDateTime(displayTrace.start_time)}`}</Pill>
            <Pill
              tooltip
            >{`Duration: ${formatMillisToHumanReadable(displayTrace.duration)}`}</Pill>
            <Pill tooltip>{`Spans: ${displayTrace.spans?.length ?? 0}`}</Pill>
            <Pill
              tooltip
            >{`Device: ${displayTrace.device_manufacturer + displayTrace.device_model}`}</Pill>
            <Pill tooltip>{`App version: ${displayTrace.app_version}`}</Pill>
            <Pill tooltip>{`Network type: ${displayTrace.network_type}`}</Pill>
          </div>
          <TraceWaterfall
            inputTrace={displayTrace}
            sessionTimelineNode={
              demo ? (
                <div
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "font-display select-none",
                  )}
                >
                  View Session Timeline
                </div>
              ) : (
                <Link
                  href={`/${params.teamId}/session_timelines/${params.appId}/${displayTrace.session_id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  View Session Timeline
                </Link>
              )
            }
          />
        </div>
      )}
    </div>
  );
}
