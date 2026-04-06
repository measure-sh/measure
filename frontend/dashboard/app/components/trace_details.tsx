"use client"

import { TraceApiStatus, emptyTrace, fetchTraceFromServer } from "@/app/api/api_calls"
import { buttonVariants } from "@/app/components/button"
import LoadingSpinner from "@/app/components/loading_spinner"
import TraceViz from "@/app/components/trace_viz"
import { cn } from "@/app/utils/shadcn_utils"
import { formatDateToHumanReadableDateTime, formatMillisToHumanReadable } from "@/app/utils/time_utils"
import { DateTime } from 'luxon'
import Link from "next/link"
import { useEffect, useState } from "react"
import Pill from "./pill"

const demoTimelineLastEventTime = DateTime.now().toUTC()
const demoTrace = {
    app_id: "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
    trace_id: "a3c7db90d18966d5c40a4a464b63ca69",
    session_id: "9aebd11f-ea7d-4e28-873e-882a7a27930e",
    user_id: "demo-user-id",
    "start_time": demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ milliseconds: 43 }).toISO(),
    "end_time": demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 1, milliseconds: 230 }).toISO(),
    duration: 1187,
    app_version: "2.0.0 (200)",
    os_version: "android 33",
    device_manufacturer: "Google",
    device_model: "Pixel 7 Pro",
    network_type: "Wifi",
    spans: [
        {
            span_name: "checkout_full_display",
            span_id: "e69fda744f2cda61",
            parent_id: "",
            status: 0,
            start_time: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ milliseconds: 43 }).toISO(),
            end_time: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 1, milliseconds: 230 }).toISO(),
            duration: 1187,
            thread_name: "main",
            device_low_power_mode: false,
            device_thermal_throttling_enabled: false,
            checkpoints: null
        },
        {
            span_name: "api_fetch_payments",
            span_id: "57238799f1f2375f",
            parent_id: "e69fda744f2cda61",
            status: 0,
            start_time: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ milliseconds: 143 }).toISO(),
            end_time: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ milliseconds: 885 }).toISO(),
            duration: 742,
            thread_name: "okhttp",
            device_low_power_mode: false,
            device_thermal_throttling_enabled: false,
            user_defined_attributes: null,
            checkpoints: null
        },
        {
            span_name: "parse_response",
            span_id: "92acb00176f06ea8",
            parent_id: "e69fda744f2cda61",
            status: 0,
            start_time: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ milliseconds: 885 }).toISO(),
            end_time: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ milliseconds: 930 }).toISO(),
            duration: 45,
            thread_name: "main",
            device_low_power_mode: false,
            device_thermal_throttling_enabled: false,
            user_defined_attributes: null,
            checkpoints: null
        },
        {
            span_name: "render_ui",
            span_id: "80187fe4b4ec928f",
            parent_id: "e69fda744f2cda61",
            status: 0,
            start_time: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ milliseconds: 930 }).toISO(),
            end_time: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 1, milliseconds: 230 }).toISO(),
            duration: 300,
            thread_name: "main",
            device_low_power_mode: false,
            device_thermal_throttling_enabled: false,
            user_defined_attributes: null,
            checkpoints: null
        }
    ]
} as any

interface TraceDetailsProps {
    params?: { teamId: string, appId: string, traceId: string }
    demo?: boolean
    hideDemoTitle?: boolean
}

export default function TraceDetails({ params = { teamId: 'demo-team-id', appId: 'demo-app-id', traceId: 'demo-trace-id' }, demo = false, hideDemoTitle = false }: TraceDetailsProps) {
    const [trace, setTrace] = useState(emptyTrace)
    const [traceApiStatus, setTraceApiStatus] = useState(TraceApiStatus.Loading)

    const getTrace = async () => {
        setTraceApiStatus(TraceApiStatus.Loading)

        if (demo) {
            setTrace(demoTrace)
            setTraceApiStatus(TraceApiStatus.Success)
            return
        }

        const result = await fetchTraceFromServer(params.appId, params.traceId)

        switch (result.status) {
            case TraceApiStatus.Error:
                setTraceApiStatus(TraceApiStatus.Error)
                break
            case TraceApiStatus.Success:
                setTraceApiStatus(TraceApiStatus.Success)
                setTrace(result.data)
                break
        }
    }

    useEffect(() => {
        getTrace()
    }, [])

    return (
        <div className="flex flex-col items-start">
            <p className="font-display text-4xl">{demo ? hideDemoTitle ? '' : 'Performance Traces' : `Trace: ${params.traceId}`}</p>
            <div className="py-2" />

            {traceApiStatus === TraceApiStatus.Loading && <LoadingSpinner />}

            {traceApiStatus === TraceApiStatus.Error && <p className="font-body text-sm">Error fetching trace, please refresh page to try again</p>}

            {traceApiStatus === TraceApiStatus.Success &&
                <div className="w-full">
                    <div className="flex flex-wrap gap-2 py-2 pb-8 items-center">
                        <Pill title={`User ID: ${trace.user_id !== "" ? trace.user_id : "N/A"}`} />
                        <Pill title={`Start Time: ${formatDateToHumanReadableDateTime(trace.start_time)}`} />
                        <Pill title={`Duration: ${formatMillisToHumanReadable(trace.duration)}`} />
                        <Pill title={`Device: ${trace.device_manufacturer + trace.device_model}`} />
                        <Pill title={`App version: ${trace.app_version}`} />
                        <Pill title={`Network type: ${trace.network_type}`} />
                    </div>
                    <TraceViz inputTrace={trace} />
                    <div className="py-4" />
                    {demo ? (
                        <div className={cn(buttonVariants({ variant: "outline" }), "justify-center w-fit font-display border border-black rounded-md select-none")}>View Session Timeline</div>
                    ) : (
                        <Link href={`/${params.teamId}/session_timelines/${params.appId}/${trace.session_id}`} className={cn(buttonVariants({ variant: "outline" }), "justify-center w-fit")}>View Session Timeline</Link>
                    )}
                </div>}
        </div>

    )
}
