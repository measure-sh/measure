"use client"

import { SessionTimelineApiStatus, emptySessionTimeline, fetchSessionTimelineFromServer } from "@/app/api/api_calls"
import LoadingSpinner from "@/app/components/loading_spinner"
import SessionTimeline from "@/app/components/session_timeline"
import { formatMillisToHumanReadable } from "@/app/utils/time_utils"
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
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl">Session: {params.sessionId}</p>
      <div className="py-2" />

      {sessionTimelineApiStatus === SessionTimelineApiStatus.Loading && <LoadingSpinner />}

      {sessionTimelineApiStatus === SessionTimelineApiStatus.Error && <p className="font-body text-sm">Error fetching session timeline, please refresh page try again</p>}

      {sessionTimelineApiStatus === SessionTimelineApiStatus.Success &&
        <div>
          <p className="font-body"> User ID: {sessionTimeline.attribute.user_id !== "" ? sessionTimeline.attribute.user_id : "N/A"}</p>
          <p className="font-body"> Duration: {formatMillisToHumanReadable(sessionTimeline.duration as unknown as number)}</p>
          <p className="font-body"> Device: {sessionTimeline.attribute.device_manufacturer + sessionTimeline.attribute.device_model}</p>
          <p className="font-body"> App version: {sessionTimeline.attribute.app_version} ({sessionTimeline.attribute.app_build})</p>
          <p className="font-body"> Network type: {sessionTimeline.attribute.network_type}</p>
          <div className="py-6" />
          <SessionTimeline teamId={params.teamId} appId={params.appId} sessionTimeline={sessionTimeline} />
        </div>}
    </div>

  )
}
