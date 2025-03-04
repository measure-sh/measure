'use client'

import { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatDateToHumanReadableDateTime, formatMillisToHumanReadable } from '../utils/time_utils'

type SessionTimelineEventDetailsProps = {
  teamId: string
  appId: string
  eventType: string
  eventDetails: any
}

export default function SessionTimelineEventDetails({
  teamId,
  appId,
  eventType,
  eventDetails
}: SessionTimelineEventDetailsProps) {

  function getBodyFromEventDetails(): ReactNode {
    // Remove user defined attrs. In case of http event, remove start_time and end_time as well since they represent uptime in ms and not timestamps.
    const entries = Object.entries(eventDetails).filter(([key]) => key !== "user_defined_attribute" && !(eventType === "http" && (key === "start_time" || key === "end_time")))
    const userDefinedAttributes = Object.entries(eventDetails).find(([key]) => key === "user_defined_attribute")?.[1]
    const keyStyle = "text-gray-400 w-1/3"
    const valueStyle = "w-2/3 pl-2"

    return (
      <div className="flex flex-col p-4 text-white w-full gap-1 text-sm">
        {entries.map(([key, value]) => {
          if (key === "stacktrace" && typeof value === "string") {
            return (
              <div className="flex flex-col" key={key}>
                <p className={keyStyle}>{key}:</p>
                <p className="w-full p-1 text-xs rounded-md">
                  {value.replace(/\n/g, "\n\t")}
                </p>
              </div>
            )
          } else if (key === "request_headers" || key === "response_headers" && typeof value === "object") {
            return (
              <div className="flex flex-col" key={key}>
                <p className={keyStyle}>{key}:</p>
                <p className="w-full p-1 text-xs rounded-md whitespace-pre">
                  {JSON.stringify(value, null, "\t")}
                </p>
              </div>
            )
          } else if (value === "" || value === null || typeof value === "object") {
            return null // Skip empty or invalid values
          } else {
            let valueString = value?.toString()
            if (valueString !== null && valueString !== undefined && (key === "timestamp" || key === "start_time" || key === "end_time")) {
              valueString = formatDateToHumanReadableDateTime(valueString)
            }
            if (valueString !== null && valueString !== undefined && key === "duration") {
              valueString = formatMillisToHumanReadable(parseInt(valueString))
            }
            return (
              <div className="flex flex-row" key={key}>
                <p className={keyStyle}>{key}</p>
                <p className={valueStyle}>{valueString}</p>
              </div>
            )
          }
        })}

        {userDefinedAttributes !== undefined && userDefinedAttributes !== null && (
          <div key="user_defined_attribute">
            {Object.entries(userDefinedAttributes).map(([attrKey, attrValue]) => (
              <div className="flex flex-row py-1" key={attrKey}>
                <p className={keyStyle}>{attrKey}</p>
                <p className={valueStyle}>{attrValue?.toString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function getAttachmentsFromEventDetails(): ReactNode {
    if (eventDetails.attachments !== undefined && eventDetails.attachments !== null && eventDetails.attachments.length > 0) {
      if ((eventType === "exception" && eventDetails.user_triggered === false) || eventType === 'anr' || eventType === 'gesture_click' || eventType === 'bug_report') {
        return (
          <div className='flex flex-wrap gap-8 px-4 pt-4 items-center'>
            {eventDetails.attachments.map((attachment: {
              key: string, location: string
            }, index: number) => (
              <Image
                key={attachment.key}
                className='border border-black'
                src={attachment.location}
                width={150}
                height={150}
                unoptimized={true}
                alt={`Screenshot ${index}`}
              />
            ))}
          </div>)
      }
    }
  }

  function getExceptionOverviewLinkFromEventDetails(): ReactNode {
    if ((eventType === "exception" && eventDetails.user_triggered === false) || eventType === "anr") {
      return (
        <div className='px-4 pt-4'>
          <Link key={eventDetails.id} href={`/${teamId}/${eventType === "exception" ? 'crashes' : 'anrs'}/${appId}/${eventDetails.group_id}/${eventDetails.type + "@" + eventDetails.file_name}`} className="outline-none justify-center w-fit hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-white hover:border-black rounded-md text-white hover:text-black font-display transition-colors duration-100 py-2 px-4">View {eventType === "exception" ? 'Crash' : 'ANR'} Details</Link>
        </div>
      )
    }
  }

  function getTraceDetailsLinkFromEventDetails(): ReactNode {
    if (eventType === "trace") {
      return (
        <div className='px-4 pt-8 pb-4'>
          <Link key={eventDetails.id} href={`/${teamId}/traces/${appId}/${eventDetails.trace_id}`} className="outline-none justify-center w-fit hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-white hover:border-black rounded-md text-white hover:text-black font-display transition-colors duration-100 py-2 px-4">View Trace Details</Link>
        </div>
      )
    }
  }

  function getBugReportDetailsLinkFromEventDetails(): ReactNode {
    if (eventType === "bug_report") {
      return (
        <div className='px-4 pt-8 pb-4'>
          <Link key={eventDetails.id} href={`/${teamId}/bug_reports/${appId}/${eventDetails.bug_report_id}`} className="outline-none justify-center w-fit hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-white hover:border-black rounded-md text-white hover:text-black font-display transition-colors duration-100 py-2 px-4">View Bug Report Details</Link>
        </div>
      )
    }
  }

  return (
    <div
      className="flex flex-col items-center bg-neutral-800 h-full selection:bg-yellow-200/50 font-display overflow-y-auto overscroll-y-contain break-words"
    >
      {getAttachmentsFromEventDetails()}
      {getExceptionOverviewLinkFromEventDetails()}
      {getTraceDetailsLinkFromEventDetails()}
      {getBugReportDetailsLinkFromEventDetails()}
      {getBodyFromEventDetails()}
    </div>
  )
}