"use client"

import { SessionReplayApiStatus, emptySessionReplay, fetchSessionReplayFromServer } from "@/app/api/api_calls";
import SessionReplay from "@/app/components/session_replay";
import { formatMillisToHumanReadable } from "@/app/utils/time_utils";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";

export default function Session({ params }: { params: { teamId: string, appId: string, sessionId: string } }) {
  const router = useRouter()

  const [sessionReplay, setSessionReplay] = useState(emptySessionReplay);
  const [sessionReplayApiStatus, setSessionReplayApiStatus] = useState(SessionReplayApiStatus.Loading);

  const getSessionReplay = async () => {
    setSessionReplayApiStatus(SessionReplayApiStatus.Loading)

    const result = await fetchSessionReplayFromServer(params.appId, params.sessionId, router)

    switch (result.status) {
      case SessionReplayApiStatus.Error:
        setSessionReplayApiStatus(SessionReplayApiStatus.Error)
        break
      case SessionReplayApiStatus.Success:
        setSessionReplayApiStatus(SessionReplayApiStatus.Success)
        setSessionReplay(result.data)
        break
    }
  }

  useEffect(() => {
    getSessionReplay()
  }, []);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-4xl">Session: {params.sessionId}</p>
      <div className="py-2" />

      {sessionReplayApiStatus === SessionReplayApiStatus.Loading && <p className="text-lg font-display">Fetching session replay...</p>}

      {sessionReplayApiStatus === SessionReplayApiStatus.Error && <p className="text-lg font-display">Error fetching session replay, please refresh page try again</p>}

      {sessionReplayApiStatus === SessionReplayApiStatus.Success &&
        <div>
          <p className="font-sans"> User ID: {sessionReplay.attribute.user_id !== "" ? sessionReplay.attribute.user_id : "N/A"}</p>
          <p className="font-sans"> Duration: {formatMillisToHumanReadable(sessionReplay.duration as unknown as number)}</p>
          <p className="font-sans"> Device: {sessionReplay.attribute.device_manufacturer + sessionReplay.attribute.device_model}</p>
          <p className="font-sans"> App version: {sessionReplay.attribute.app_version} ({sessionReplay.attribute.app_build})</p>
          <p className="font-sans"> Network type: {sessionReplay.attribute.network_type}</p>
          <div className="py-6" />
          <SessionReplay teamId={params.teamId} appId={params.appId} sessionReplay={sessionReplay} />
        </div>}
    </div>

  )
}
