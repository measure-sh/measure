"use client"

import { BugReportApiStatus, emptyBugReport, fetchBugReportFromServer, UpdateBugReportStatusApiStatus, updateBugReportStatusFromServer } from "@/app/api/api_calls";
import Image from 'next/image';
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { FormEventHandler, useEffect, useState } from "react";

export default function BugReport({ params }: { params: { teamId: string, appId: string, bugReportId: string } }) {
  const router = useRouter()

  const [bugReport, setBugReport] = useState(emptyBugReport);
  const [bugReportApiStatus, setBugReportApiStatus] = useState(BugReportApiStatus.Loading);
  const [updateBugReportStatusApiStatus, setUpdateBugReportStatusApiStatus] = useState(UpdateBugReportStatusApiStatus.Init);

  const getBugReport = async () => {
    setBugReportApiStatus(BugReportApiStatus.Loading)

    const result = await fetchBugReportFromServer(params.appId, params.bugReportId, router)

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
  }, []);


  const updateBugReportStatus: FormEventHandler = async (event) => {
    event.preventDefault();

    setUpdateBugReportStatusApiStatus(UpdateBugReportStatusApiStatus.Loading)

    const result = await updateBugReportStatusFromServer(params.appId, params.bugReportId, bugReport.status === 0 ? 1 : 0, router)

    switch (result.status) {
      case UpdateBugReportStatusApiStatus.Error:
        setUpdateBugReportStatusApiStatus(UpdateBugReportStatusApiStatus.Error)
        break
      case UpdateBugReportStatusApiStatus.Success:
        setUpdateBugReportStatusApiStatus(UpdateBugReportStatusApiStatus.Success)
        setBugReport({ ...bugReport, status: bugReport.status === 0 ? 1 : 0 }) // Toggle status
        break
    }
  }

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display text-4xl">Bug Report: {params.bugReportId}</p>
      <div className="py-2" />

      {bugReportApiStatus === BugReportApiStatus.Loading && <p className="text-lg font-display">Fetching bug report...</p>}

      {bugReportApiStatus === BugReportApiStatus.Error && <p className="text-lg font-display">Error fetching bug report, please refresh page try again</p>}

      {bugReportApiStatus === BugReportApiStatus.Success &&
        <div>
          <p className={`w-fit px-2 py-1 rounded-full border text-sm font-sans ${bugReport.status === 0 ? 'border-green-600 text-green-600 bg-green-50' : 'border-indigo-600 text-indigo-600 bg-indigo-50'}`}>{bugReport.status === 0 ? 'Open' : 'Closed'}</p>
          <div className="py-2" />
          <p className="font-sans"> User ID: {bugReport.attribute.user_id !== "" ? bugReport.attribute.user_id : "N/A"}</p>
          <p className="font-sans"> Time: {formatDateToHumanReadableDateTime(bugReport.timestamp)}</p>
          <p className="font-sans"> Device: {bugReport.attribute.device_manufacturer + bugReport.attribute.device_model}</p>
          <p className="font-sans"> App version: {bugReport.attribute.app_version} ({bugReport.attribute.app_build})</p>
          <p className="font-sans"> Network type: {bugReport.attribute.network_type}</p>
          <div className="py-6" />
          {bugReport.description && <p className="font-sans text-xl">{bugReport.description}</p>}
          <div className="py-8" />
          <div className="flex flex-row">
            <Link href={`/${params.teamId}/sessions/${params.appId}/${bugReport.session_id}`} className="outline-none justify-center w-fit hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4">View Session</Link>
            <div className="px-2" />
            <button onClick={updateBugReportStatus} disabled={updateBugReportStatusApiStatus === UpdateBugReportStatusApiStatus.Loading} className={`w-fit outline-none hover:enabled:bg-yellow-200 focus-visible:enabled:bg-yellow-200 active:enabled:bg-yellow-300 font-display border border-black rounded-md transition-colors duration-100 py-2 px-4 ${(updateBugReportStatusApiStatus === UpdateBugReportStatusApiStatus.Loading) ? 'pointer-events-none' : 'pointer-events-auto'}`}>{bugReport.status === 0 ? "Close Bug Report" : "Re-Open Bug Report"}</button>
          </div>
          {updateBugReportStatusApiStatus === UpdateBugReportStatusApiStatus.Error && <p className="font-display text-xs mt-2">Error updating bug report status. Please try again.</p>}

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
