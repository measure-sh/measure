"use client"

import { SessionTimelineApiStatus, emptySessionTimeline, fetchSessionTimelineFromServer } from "@/app/api/api_calls"
import LoadingSpinner from "@/app/components/loading_spinner"
import SessionTimeline from "@/app/components/session_timeline"
import { useEffect, useState } from "react"

export default function Session({ params }: { params: { teamId: string, appId: string, sessionId: string } }) {
  const [sessionTimeline, setSessionTimeline] = useState(emptySessionTimeline)
  const [sessionTimelineApiStatus, setSessionTimelineApiStatus] = useState(SessionTimelineApiStatus.Loading)

  const getSessionTimeline = async () => {
    setSessionTimelineApiStatus(SessionTimelineApiStatus.Loading)

    const result = await fetchSessionTimelineFromServer(params.appId, params.sessionId)

    switch (result.status) {
      case SessionTimelineApiStatus.Error:
        setSessionTimelineApiStatus(SessionTimelineApiStatus.Error)
        break
      case SessionTimelineApiStatus.Success:
        setSessionTimelineApiStatus(SessionTimelineApiStatus.Success)
        setSessionTimeline(result.data)
        break
    }
  }

  useEffect(() => {
    getSessionTimeline()
  }, [])

  return (
    <div className="flex flex-col items-start">
      <p className="font-display text-4xl">Session: {params.sessionId}</p>
      <div className="py-2" />

      {sessionTimelineApiStatus === SessionTimelineApiStatus.Loading && <LoadingSpinner />}

      {sessionTimelineApiStatus === SessionTimelineApiStatus.Error && <p className="font-body text-sm">Error fetching session timeline, please refresh page to try again</p>}

      {sessionTimelineApiStatus === SessionTimelineApiStatus.Success &&
        <div className="w-full">
          <SessionTimeline teamId={params.teamId} appId={params.appId} sessionTimeline={sessionTimeline} demo={false} />
        </div>}
    </div>

  )
}
