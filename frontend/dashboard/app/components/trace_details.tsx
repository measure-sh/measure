"use client"

import { buttonVariants } from "@/app/components/button"
import { Skeleton } from "@/app/components/skeleton"
import TraceViz from "@/app/components/trace_viz"
import { useTraceQuery } from "@/app/query/hooks"
import { cn } from "@/app/utils/shadcn_utils"
import { formatDateToHumanReadableDateTime, formatMillisToHumanReadable } from "@/app/utils/time_utils"
import { DateTime } from 'luxon'
import Link from "next/link"
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
    const { data: trace, status: traceStatus } = useTraceQuery(demo ? '' : params.appId, demo ? '' : params.traceId)

    const displayTrace = demo ? demoTrace : trace
    const displayStatus = demo ? 'success' : traceStatus

    return (
        <div className="flex flex-col items-start">
            <p className="font-display text-4xl">{demo ? hideDemoTitle ? '' : 'Performance Traces' : ''}</p>
            <div className="py-2" />

            {displayStatus === 'pending' &&
                <div className="flex flex-col w-full py-4">
                    {/* Pills */}
                    <div className="flex flex-wrap gap-2 py-2 pb-8">
                        <Skeleton className="h-6 w-32 rounded-full" />
                        <Skeleton className="h-6 w-36 rounded-full" />
                        <Skeleton className="h-6 w-28 rounded-full" />
                        <Skeleton className="h-6 w-36 rounded-full" />
                        <Skeleton className="h-6 w-32 rounded-full" />
                        <Skeleton className="h-6 w-32 rounded-full" />
                    </div>
                    {/* Trace visualization */}
                    <Skeleton className="h-[300px] w-full rounded-lg" />
                    {/* Button */}
                    <div className="py-4" />
                    <Skeleton className="h-9 w-44" />
                </div>
            }

            {displayStatus === 'error' && <p className="font-body text-sm">Error fetching trace, please refresh page to try again</p>}

            {displayStatus === 'success' &&
                <div className="w-full">
                    <div className="flex flex-wrap gap-2 py-2 pb-8 items-center">
                        <Pill title={`User ID: ${displayTrace.user_id !== "" ? displayTrace.user_id : "N/A"}`} />
                        <Pill title={`Start Time: ${formatDateToHumanReadableDateTime(displayTrace.start_time)}`} />
                        <Pill title={`Duration: ${formatMillisToHumanReadable(displayTrace.duration)}`} />
                        <Pill title={`Device: ${displayTrace.device_manufacturer + displayTrace.device_model}`} />
                        <Pill title={`App version: ${displayTrace.app_version}`} />
                        <Pill title={`Network type: ${displayTrace.network_type}`} />
                    </div>
                    <TraceViz inputTrace={displayTrace} />
                    <div className="py-4" />
                    {demo ? (
                        <div className={cn(buttonVariants({ variant: "outline" }), "justify-center w-fit font-display border border-black rounded-md select-none")}>View Session Timeline</div>
                    ) : (
                        <Link href={`/${params.teamId}/session_timelines/${params.appId}/${displayTrace.session_id}`} className={cn(buttonVariants({ variant: "outline" }), "justify-center w-fit")}>View Session Timeline</Link>
                    )}
                </div>}
        </div>

    )
}
