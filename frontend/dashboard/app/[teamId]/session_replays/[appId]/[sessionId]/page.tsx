"use client";

import SessionReplay from "@/app/components/session_replay";
import { Skeleton } from "@/app/components/skeleton";
import { useSessionReplayQuery } from "@/app/query/hooks";
import { track } from "@/app/utils/analytics/track";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useRef } from "react";

export default function Session(props: {
  params: Promise<{ teamId: string; appId: string; sessionId: string }>;
}) {
  const params = use(props.params);
  const { data: session, status } = useSessionReplayQuery(
    params.appId,
    params.sessionId,
  );
  const searchParams = useSearchParams();
  const entryPoint = searchParams.get("from") ?? "direct";

  // Fire `session_investigated` once per session view, after the session
  // data has loaded so `app_platform` is populated. Ref keyed by sessionId
  // covers within-route navigation (session A → session B without remount).
  const investigatedSessionRef = useRef<string | null>(null);
  useEffect(() => {
    const osName = session?.attribute?.os_name;
    if (!osName) {
      return;
    }
    if (investigatedSessionRef.current === params.sessionId) {
      return;
    }
    investigatedSessionRef.current = params.sessionId;
    track("session_investigated", {
      team_id: params.teamId,
      app_id: params.appId,
      app_platform: osName,
      feature_area: "sessions",
      entry_point: entryPoint,
    });
  }, [
    params.teamId,
    params.appId,
    params.sessionId,
    session?.attribute?.os_name,
    entryPoint,
  ]);

  return (
    <div className="flex flex-col items-start">
      <div className="py-2" />

      {status === "pending" && (
        <div className="flex flex-col w-full gap-4">
          {/* Session attribute pills */}
          <div className="flex flex-wrap gap-2 py-2 pb-4 items-center">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            {/* Stage, metric lanes, scrubber and transport */}
            <div className="flex flex-col grow min-w-0 gap-3">
              <Skeleton className="h-150 w-full rounded-md" />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-8.5 w-full rounded-md" />
                <Skeleton className="h-8.5 w-full rounded-md" />
              </div>
              <div className="flex flex-col gap-1">
                <Skeleton className="h-8 w-full rounded-sm" />
                <div className="flex flex-row items-center gap-2">
                  <Skeleton className="size-9 rounded-md" />
                  <Skeleton className="size-9 rounded-md" />
                  <Skeleton className="h-4 w-32" />
                  <div className="grow" />
                  <Skeleton className="h-7 w-44 rounded-md" />
                </div>
              </div>
            </div>
            {/* Event list */}
            <Skeleton className="h-150 w-full lg:w-140 shrink-0 rounded-md" />
          </div>
        </div>
      )}

      {status === "error" && (
        <p className="font-body text-sm">
          Error fetching session replay, please refresh page to try again
        </p>
      )}

      {status === "success" && (
        <div className="w-full">
          <SessionReplay
            key={params.sessionId}
            teamId={params.teamId}
            appId={params.appId}
            session={session}
          />
        </div>
      )}
    </div>
  );
}
