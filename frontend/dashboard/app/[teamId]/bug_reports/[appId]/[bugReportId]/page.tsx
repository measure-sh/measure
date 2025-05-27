"use client"

import { BugReportApiStatus, emptyBugReport, fetchBugReportFromServer, UpdateBugReportStatusApiStatus, updateBugReportStatusFromServer } from "@/app/api/api_calls"
import Image from 'next/image'
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils"
import Link from "next/link"
import { FormEventHandler, useEffect, useState } from "react"
import { Button, buttonVariants } from "@/app/components/button"
import { cn } from "@/app/utils/shadcn_utils"
import { toastNegative, toastPositive } from "@/app/utils/use_toast"
import LoadingSpinner from "@/app/components/loading_spinner"

export default function BugReport({ params }: { params: { teamId: string, appId: string, bugReportId: string } }) {
  const [bugReport, setBugReport] = useState(emptyBugReport)
  const [bugReportApiStatus, setBugReportApiStatus] = useState(BugReportApiStatus.Loading)
  const [updateBugReportStatusApiStatus, setUpdateBugReportStatusApiStatus] = useState(UpdateBugReportStatusApiStatus.Init)

  const getBugReport = async () => {
    setBugReportApiStatus(BugReportApiStatus.Loading)

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


  const updateBugReportStatus: FormEventHandler = async (event) => {
    event.preventDefault()

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
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl">Bug Report: {params.bugReportId}</p>
      <div className="py-2" />

      {bugReportApiStatus === BugReportApiStatus.Loading && <LoadingSpinner />}

      {bugReportApiStatus === BugReportApiStatus.Error && <p className="text-lg font-display">Error fetching bug report, please refresh page try again</p>}

      {bugReportApiStatus === BugReportApiStatus.Success &&
        <div>
          <p className={`w-fit px-2 py-1 rounded-full border text-sm font-body ${bugReport.status === 0 ? 'border-green-600 text-green-600 bg-green-50' : 'border-indigo-600 text-indigo-600 bg-indigo-50'}`}>{bugReport.status === 0 ? 'Open' : 'Closed'}</p>
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
            <Link href={`/${params.teamId}/sessions/${params.appId}/${bugReport.session_id}`} className={cn(buttonVariants({ variant: "outline" }), "font-display border border-black rounded-md select-none")}>View Session</Link>
            <div className="px-2" />
            <Button
              variant="outline"
              className="w-fit font-display border border-black rounded-md select-none"
              disabled={updateBugReportStatusApiStatus === UpdateBugReportStatusApiStatus.Loading}
              onClick={updateBugReportStatus}>
              {bugReport.status === 0 ? "Close Bug Report" : "Re-Open Bug Report"}
            </Button>
          </div>

          <div className="py-4" />
          {bugReport.attachments !== undefined && bugReport.attachments !== null && bugReport.attachments.length > 0 &&
            <div className='flex flex-wrap gap-8 items-center'>
              {bugReport.attachments.map((attachment, index) => (
                <Image
                  key={attachment.key}
                  className='border border-black'
                  src={attachment.location}
                  width={200}
                  height={200}
                  unoptimized={true}
                  alt={`Screenshot ${index}`}
                />
              ))}
            </div>}
        </div>}
    </div>
  )
}
