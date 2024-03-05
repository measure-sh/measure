"use client"

import { SessionReplayApiStatus, emptySessionReplay, fetchSessionReplayFromServer } from "@/app/api/api_calls";
import SessionReplay from "@/app/components/session_replay";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";

export default function Session({ params }: { params: { appId: string, sessionId: string } }) {
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
      <p className="font-display font-regular text-4xl text-center">Session: {params.sessionId}</p>

      {sessionReplayApiStatus === SessionReplayApiStatus.Loading && <p className="text-lg font-display">Fetching session replay...</p>}

      {sessionReplayApiStatus === SessionReplayApiStatus.Error && <p className="text-lg font-display">Error fetching session replay, please refresh page try again</p>}

      {sessionReplayApiStatus === SessionReplayApiStatus.Success &&
        <div>
          <p className="font-sans"> First event time: {new Date(sessionReplay.first_event_timestamp).toLocaleDateString()}, {new Date(sessionReplay.first_event_timestamp).toLocaleTimeString()}</p>
          <p className="font-sans"> First event time: {new Date(sessionReplay.last_event_timestamp).toLocaleDateString()}, {new Date(sessionReplay.last_event_timestamp).toLocaleTimeString()}</p>
          <p className="font-sans"> Device: {sessionReplay.resource.device_manufacturer + sessionReplay.resource.device_model}</p>
          <p className="font-sans"> App version: {sessionReplay.resource.app_version}</p>
          <p className="font-sans"> Network type: {sessionReplay.resource.network_type}</p>
          <div className="py-6" />
          <SessionReplay sessionReplay={sessionReplay} />
        </div>}
    </div>

  )
}
