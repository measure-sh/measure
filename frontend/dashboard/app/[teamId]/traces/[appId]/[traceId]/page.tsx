"use client"

import { SessionTimelineApiStatus, TraceApiStatus, emptyTrace, fetchSessionTimelineFromServer, fetchTraceFromServer } from "@/app/api/api_calls"
import { buttonVariants } from "@/app/components/button"
import LoadingSpinner from "@/app/components/loading_spinner"
import TraceViz from "@/app/components/trace_viz"
import { useAIChatContext } from "@/app/context/ai_chat_context"
import { cn } from "@/app/utils/shadcn_utils"
import { formatDateToHumanReadableDateTime, formatMillisToHumanReadable } from "@/app/utils/time_utils"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function TraceDetails({ params }: { params: { teamId: string, appId: string, traceId: string } }) {
  const { setPageContext } = useAIChatContext()

  const [trace, setTrace] = useState(emptyTrace)
  const [traceApiStatus, setTraceApiStatus] = useState(TraceApiStatus.Loading)

  const getTrace = async () => {
    setTraceApiStatus(TraceApiStatus.Loading)

    const result = await fetchTraceFromServer(params.appId, params.traceId)

    switch (result.status) {
      case TraceApiStatus.Error:
        setTraceApiStatus(TraceApiStatus.Error)
        setPageContext({
          appId: params.appId,
          enable: false,
          fileName: "",
          action: "",
          content: ""
        })
        break
      case TraceApiStatus.Success:
        setTraceApiStatus(TraceApiStatus.Success)
        setTrace(result.data)
        getSessionTimelineAndSetPageContext(params.appId, result.data.session_id, result.data)
        break
    }
  }

  const getSessionTimelineAndSetPageContext = async (appId: string, sessionId: string, trace: any) => {
    const result = await fetchSessionTimelineFromServer(appId, sessionId)

    switch (result.status) {
      case SessionTimelineApiStatus.Error:
        setPageContext({
          appId: appId,
          enable: true,
          fileName: 'trace_details',
          action: `Attach Trace Details`,
          content: JSON.stringify(trace)
        })
        break
      case SessionTimelineApiStatus.Success:
        setPageContext({
          appId: appId,
          enable: true,
          fileName: 'trace_details',
          action: `Attach Trace Details`,
          content: "trace:" + JSON.stringify(trace) + "\nsessionTimeline:" + JSON.stringify(result.data)
        })
        break
    }
  }

  useEffect(() => {
    getTrace()
  }, [])

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl">Trace: {params.traceId}</p>
      <div className="py-2" />

      {traceApiStatus === TraceApiStatus.Loading && <LoadingSpinner />}

      {traceApiStatus === TraceApiStatus.Error && <p className="font-body text-sm">Error fetching trace, please refresh page try again</p>}

      {traceApiStatus === TraceApiStatus.Success &&
        <div>
          <p className="font-body"> User ID: {trace.user_id !== "" ? trace.user_id : "N/A"}</p>
          <p className="font-body"> Start Time: {formatDateToHumanReadableDateTime(trace.start_time)}</p>
          <p className="font-body"> Duration: {formatMillisToHumanReadable(trace.duration)}</p>
          <p className="font-body"> Device: {trace.device_manufacturer + trace.device_model}</p>
          <p className="font-body"> App version: {trace.app_version}</p>
          <p className="font-body"> Network type: {trace.network_type}</p>
          <div className="py-4" />
          <Link href={`/${params.teamId}/sessions/${params.appId}/${trace.session_id}`} className={cn(buttonVariants({ variant: "outline" }), "justify-center w-fit font-display border border-black rounded-md select-none")}>View Session</Link>
          <div className="py-4" />
          <TraceViz inputTrace={trace} />
        </div>}
      <div className="py-4" />
    </div>

  )
}
