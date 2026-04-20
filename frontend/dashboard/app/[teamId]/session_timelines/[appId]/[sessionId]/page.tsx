"use client"

import SessionTimeline from "@/app/components/session_timeline"
import { Skeleton } from "@/app/components/skeleton"
import { useSessionTimelineQuery } from "@/app/query/hooks"

export default function Session({ params }: { params: { teamId: string, appId: string, sessionId: string } }) {
  const { data: sessionTimeline, status } = useSessionTimelineQuery(params.appId, params.sessionId)

  return (
    <div className="flex flex-col items-start">
      <div className="py-2" />

      {status === 'pending' &&
        <div className="flex flex-col w-full py-4">
          {/* Pills */}
          <div className="flex flex-wrap gap-2 py-2 pb-8">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          {/* Charts */}
          <Skeleton className="h-[200px] w-full rounded-lg" />
          <div className="py-2" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
          <div className="py-2" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
          <div className="py-2" />
          <Skeleton className="h-4 w-full" />
          {/* Event filters */}
          <div className="flex flex-wrap gap-8 items-center mt-4">
            <Skeleton className="h-9 w-[150px]" />
            <Skeleton className="h-9 w-[150px]" />
          </div>
          {/* Events panel */}
          <div className="flex flex-row mt-4 border border-border rounded-md w-full h-[600px]">
            <div className="h-full w-2/3 flex flex-col gap-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
            <div className="w-0.5 h-full bg-border" />
            <div className="h-full w-1/3 p-4">
              <Skeleton className="h-full w-full rounded-lg" />
            </div>
          </div>
        </div>
      }

      {status === 'error' && <p className="font-body text-sm">Error fetching session timeline, please refresh page to try again</p>}

      {status === 'success' &&
        <div className="w-full">
          <SessionTimeline teamId={params.teamId} appId={params.appId} sessionTimeline={sessionTimeline} demo={false} />
        </div>}
    </div>

  )
}
