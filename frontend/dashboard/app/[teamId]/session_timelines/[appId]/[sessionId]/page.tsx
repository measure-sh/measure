"use client";

import SessionTimeline from "@/app/components/session_timeline";
import { Skeleton } from "@/app/components/skeleton";
import { useSessionTimelineQuery } from "@/app/query/hooks";

export default function Session({
  params,
}: {
  params: { teamId: string; appId: string; sessionId: string };
}) {
  const { data: sessionTimeline, status } = useSessionTimelineQuery(
    params.appId,
    params.sessionId,
  );

  return (
    <div className="flex flex-col items-start">
      <div className="py-2" />

      {status === "pending" && (
        <div className="flex flex-col w-full py-4">
          {/* Pills */}
          <div className="flex flex-wrap gap-2 py-2 pb-4">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          {/* Sticky region: charts + filters */}
          <Skeleton className="h-32 w-full rounded-md" />
          <div className="py-1" />
          <Skeleton className="h-32 w-full rounded-md" />
          <div className="py-1" />
          <Skeleton className="h-32 w-full rounded-md" />
          <div className="flex flex-wrap gap-4 items-center py-3">
            <Skeleton className="h-9 w-[150px]" />
            <Skeleton className="h-9 w-[150px]" />
          </div>
          {/* Events list */}
          <div className="flex flex-col w-full divide-y divide-border">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-none" />
            ))}
          </div>
        </div>
      )}

      {status === "error" && (
        <p className="font-body text-sm">
          Error fetching session timeline, please refresh page to try again
        </p>
      )}

      {status === "success" && (
        <div className="w-full">
          <SessionTimeline
            teamId={params.teamId}
            appId={params.appId}
            sessionTimeline={sessionTimeline}
            demo={false}
          />
        </div>
      )}
    </div>
  );
}
