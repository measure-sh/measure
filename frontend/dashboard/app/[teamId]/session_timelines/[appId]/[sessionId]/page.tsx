"use client"

import LoadingSpinner from "@/app/components/loading_spinner"
import SessionTimeline from "@/app/components/session_timeline"
import { useSessionTimelineQuery } from "@/app/query/hooks"

export default function Session({ params }: { params: { teamId: string, appId: string, sessionId: string } }) {
  const { data: sessionTimeline, status } = useSessionTimelineQuery(params.appId, params.sessionId)

  return (
    <div className="flex flex-col items-start">
      <p className="font-display text-4xl">Session: {params.sessionId}</p>
      <div className="py-2" />

      {status === 'pending' && <LoadingSpinner />}

      {status === 'error' && <p className="font-body text-sm">Error fetching session timeline, please refresh page to try again</p>}

      {status === 'success' &&
        <div className="w-full">
          <SessionTimeline teamId={params.teamId} appId={params.appId} sessionTimeline={sessionTimeline} demo={false} />
        </div>}
    </div>

  )
}
