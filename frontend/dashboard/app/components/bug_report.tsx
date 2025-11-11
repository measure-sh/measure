"use client"

import { BugReportApiStatus, emptyBugReport, fetchBugReportFromServer, UpdateBugReportStatusApiStatus, updateBugReportStatusFromServer } from "@/app/api/api_calls"
import { Button, buttonVariants } from "@/app/components/button"
import LoadingSpinner from "@/app/components/loading_spinner"
import { cn } from "@/app/utils/shadcn_utils"
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils"
import { toastNegative, toastPositive } from "@/app/utils/use_toast"
import { DateTime } from 'luxon'
import Image from 'next/image'
import Link from "next/link"
import { FormEventHandler, useEffect, useState } from "react"

const demoBugReport = {
    session_id: "81f06f23-4291-4590-a5df-c96d57d3c692",
    app_id: "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
    event_id: "f917ce21-9b8e-479d-9daa-888e32c66739",
    status: 0,
    description: "When I tap the 'Pay' button on the Checkout, the app crashes immediately. This seems to happen when I go to other app from checkout screen and then come back to finish paying. Reproducible on Pixel 7 Pro. Steps: Open app → go to Checkout → go to another app -> come back to checkout screen -> tap 'Pay'.",
    timestamp: DateTime.now().minus({ minutes: 2 }).toUTC().toISO(),
    updated_at: DateTime.now().minus({ minutes: 2 }).toUTC().toISO(),
    attribute: {
        installation_id: "00000000-0000-0000-0000-000000000000",
        app_version: "2.0.0",
        app_build: "200",
        app_unique_id: "",
        measure_sdk_version: "",
        platform: "",
        thread_name: "",
        user_id: "demo-user-id",
        device_name: "sunfish",
        device_model: "Pixel 7 Pro",
        device_manufacturer: "Google",
        device_type: "",
        device_is_foldable: false,
        device_is_physical: false,
        device_density_dpi: 0,
        device_width_px: 0,
        device_height_px: 0,
        device_density: 0,
        device_locale: "en-US",
        device_low_power_mode: false,
        device_thermal_throttling_enabled: false,
        device_cpu_arch: "",
        os_name: "android",
        os_version: "33",
        os_page_size: 0,
        network_type: "Wifi",
        network_provider: "unknown",
        network_generation: "unknown"
    },
    attachments: [
        {
            id: "f34247a5-f0c1-4808-aa1d-c957e6214743",
            name: "snapshot.svg",
            type: "screenshot",
            key: "f34247a5-f0c1-4808-aa1d-c957e6214743.svg",
            location: "/images/demo_checkout_screenshot.png"
        }
    ]
} as any

interface BugReportProps {
    params?: { teamId: string, appId: string, bugReportId: string }
    demo?: boolean
    hideDemoTitle?: boolean
}

export default function BugReport({ params = { teamId: 'demo-team-id', appId: 'demo-app-id', bugReportId: 'demo-bug-report-id' }, demo = false, hideDemoTitle = false }: BugReportProps) {
    const [bugReport, setBugReport] = useState(emptyBugReport)
    const [bugReportApiStatus, setBugReportApiStatus] = useState(BugReportApiStatus.Loading)
    const [updateBugReportStatusApiStatus, setUpdateBugReportStatusApiStatus] = useState(UpdateBugReportStatusApiStatus.Init)
    const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

    const getBugReport = async () => {
        setBugReportApiStatus(BugReportApiStatus.Loading)

        if (demo) {
            setBugReport(demoBugReport)
            setBugReportApiStatus(BugReportApiStatus.Success)
            return
        }

        const result = await fetchBugReportFromServer(params.appId, params.bugReportId)

        switch (result.status) {
            case BugReportApiStatus.Error:
                setBugReportApiStatus(BugReportApiStatus.Error)
                break
            case BugReportApiStatus.Success:
                setBugReportApiStatus(BugReportApiStatus.Success)
                setBugReport(result.data)
                break
        }
    }

    useEffect(() => {
        getBugReport()
    }, [])

    const handleImageError = (key: string) => {
        setImageErrors(prev => new Set(prev).add(key))
    }

    const updateBugReportStatus: FormEventHandler = async (event) => {
        event.preventDefault()
        if (demo) {
            setUpdateBugReportStatusApiStatus(UpdateBugReportStatusApiStatus.Loading)
            setTimeout(() => {
                setBugReport({ ...bugReport, status: bugReport.status === 0 ? 1 : 0 })
                setUpdateBugReportStatusApiStatus(UpdateBugReportStatusApiStatus.Success)
            }, 100)
            return
        }

        setUpdateBugReportStatusApiStatus(UpdateBugReportStatusApiStatus.Loading)

        const result = await updateBugReportStatusFromServer(params.appId, params.bugReportId, bugReport.status === 0 ? 1 : 0)

        switch (result.status) {
            case UpdateBugReportStatusApiStatus.Error:
                setUpdateBugReportStatusApiStatus(UpdateBugReportStatusApiStatus.Error)
                toastNegative("Error updating bug report status. Please try again.")
                break
            case UpdateBugReportStatusApiStatus.Success:
                setUpdateBugReportStatusApiStatus(UpdateBugReportStatusApiStatus.Success)
                setBugReport({ ...bugReport, status: bugReport.status === 0 ? 1 : 0 }) // Toggle status
                toastPositive(bugReport.status === 0 ? "Bug report closed" : "Bug report re-opened")
                break
        }
    }

    return (
        <div className="flex flex-col items-start">
            <p className="font-display text-4xl">{demo ? hideDemoTitle ? '' : 'Bug Reports' : `Bug Report: ${params.bugReportId}`}</p>
            <div className="py-2" />

            {bugReportApiStatus === BugReportApiStatus.Loading && <LoadingSpinner />}

            {bugReportApiStatus === BugReportApiStatus.Error && <p className="font-body text-sm">Error fetching bug report, please refresh page try again</p>}

            {bugReportApiStatus === BugReportApiStatus.Success &&
                <div>
                    <p className={`w-fit px-2 py-1 rounded-full border text-sm font-body ${bugReport.status === 0 ? 'border-green-600 dark:border-green-500 text-green-600 dark:text-green-500 bg-green-50 dark:bg-background' : 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-background'}`}>{bugReport.status === 0 ? 'Open' : 'Closed'}</p>
                    <div className="py-2" />
                    <p className="font-body"> User ID: {bugReport.attribute.user_id !== "" ? bugReport.attribute.user_id : "N/A"}</p>
                    <p className="font-body"> Time: {formatDateToHumanReadableDateTime(bugReport.timestamp)}</p>
                    <p className="font-body"> Device: {bugReport.attribute.device_manufacturer + bugReport.attribute.device_model}</p>
                    <p className="font-body"> App version: {bugReport.attribute.app_version} ({bugReport.attribute.app_build})</p>
                    <p className="font-body"> Network type: {bugReport.attribute.network_type}</p>
                    {bugReport.user_defined_attribute !== undefined && bugReport.user_defined_attribute !== null && (
                        <div key="user_defined_attribute">
                            {Object.entries(bugReport.user_defined_attribute).map(([attrKey, attrValue]) => (
                                <p key={attrKey + ":" + attrValue} className="font-body"> {attrKey}: {attrValue?.toString()}</p>
                            ))}
                        </div>
                    )}

                    <div className="py-6" />
                    {bugReport.description && <p className="font-body text-lg">{bugReport.description}</p>}
                    <div className="py-8" />
                    <div className="flex flex-row">
                        {demo ? (
                            <div className={cn(buttonVariants({ variant: "outline" }))}>View Session Timeline</div>
                        ) : (
                            <Link href={`/${params.teamId}/session_timelines/${params.appId}/${bugReport.session_id}`} className={cn(buttonVariants({ variant: "outline" }))}>View Session Timeline</Link>
                        )}
                        <div className="px-2" />
                        <Button
                            variant="outline"
                            className="w-fit"
                            disabled={updateBugReportStatusApiStatus === UpdateBugReportStatusApiStatus.Loading}
                            onClick={updateBugReportStatus}>
                            {bugReport.status === 0 ? "Close Bug Report" : "Re-Open Bug Report"}
                        </Button>
                    </div>

                    <div className="py-4" />
                    {bugReport.attachments !== undefined && bugReport.attachments !== null && bugReport.attachments.length > 0 &&
                        <div className='flex flex-wrap gap-8 items-center'>
                            {bugReport.attachments.map((attachment, index) => (
                                !imageErrors.has(attachment.key) && (
                                    <div key={attachment.key} className="relative">
                                        <Image
                                            className='border border-black'
                                            src={attachment.location}
                                            width={200}
                                            height={200}
                                            unoptimized={true}
                                            alt={`Screenshot ${index}`}
                                            onError={() => handleImageError(attachment.key)}
                                        />
                                    </div>
                                )
                            ))}
                        </div>}
                </div>}
        </div>
    )
}