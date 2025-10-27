'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ReactNode, useState } from 'react'
import { cn } from '../utils/shadcn_utils'
import { formatDateToHumanReadableDateTime, formatMillisToHumanReadable } from '../utils/time_utils'
import { buttonVariants } from './button'
import LayoutSnapshot from './layout_snapshot'

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
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const handleImageError = (key: string) => {
    setImageErrors(prev => new Set(prev).add(key))
  }

  function getBodyFromEventDetails(): ReactNode {
    // Remove user defined attrs. In case of http event, remove start_time and end_time as well since they represent uptime in ms and not timestamps.
    const entries = Object.entries(eventDetails).filter(([key]) => key !== "user_defined_attribute" && !(eventType === "http" && (key === "start_time" || key === "end_time")))
    const userDefinedAttributes = Object.entries(eventDetails).find(([key]) => key === "user_defined_attribute")?.[1]
    const errorException = Object.entries(eventDetails).filter(([key]) => key === "error")?.[0]?.[1] as Record<string, unknown>
    const keyStyle = "text-gray-400 w-1/3"
    const valueStyle = "w-2/3 pl-2"

    return (
      <div className="flex flex-col p-4 text-white w-full gap-1 text-sm">
        {entries.map(([key, value]) => {
          if (key === "stacktrace" && typeof value === "string" && value !== "") {
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

        {errorException !== undefined && errorException !== null && (errorException.numcode !== 0 || errorException.code !== "" || errorException.meta !== null) && (
          <div key="error">
            {Object.entries(errorException).map(([errKey, errVal]) => {
              return (
                <div key={`error_${errKey}`} className="flex flex-row py-1">
                  <p className={keyStyle}>{errKey}</p>
                  {
                    typeof errVal === "object" ?
                      <pre className={valueStyle}><code className="text-pretty">{JSON.stringify(errVal, null, 2)}</code></pre>
                      : <p className={valueStyle}>{errVal?.toString()}</p>
                  }
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  function getJsonLayoutSnapshotsFromEventDetails(): ReactNode {
    if (eventDetails.attachments !== undefined && eventDetails.attachments !== null && eventDetails.attachments.length > 0) {
      if (eventType === 'gesture_click' || eventType === 'gesture_long_click' || eventType === 'gesture_scroll') {
        return (
          <div className='flex flex-col gap-8 p-4 items-center'>
            {eventDetails.attachments.filter((attachment: {
              key: string, location: string, type: string
            }) => attachment.type === 'layout_snapshot_json')
              .map((attachment: {
                key: string, location: string
              }) => (
                <LayoutSnapshot
                  key={attachment.key}
                  width={350}
                  height={350}
                  layoutUrl={attachment.location}
                />
              ))}
          </div>
        )
      }
    }
  }

  function getImageLayoutSnapshotsFromEventDetails(): ReactNode {
    if (eventDetails.attachments !== undefined && eventDetails.attachments !== null && eventDetails.attachments.length > 0) {
      if ((eventType === "exception" && eventDetails.user_triggered === false) || eventType === 'anr' || eventType === 'gesture_click' || eventType === 'gesture_long_click' || eventType === 'gesture_scroll' || eventType === 'bug_report') {
        return (
          <div className='flex flex-wrap gap-8 p-4 items-center'>
            {eventDetails.attachments
              .filter((attachment: {
                key: string, location: string, type: string
              }) => attachment.type === 'layout_snapshot' && !imageErrors.has(attachment.key))
              .map((attachment: {
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
                  onError={() => handleImageError(attachment.key)}
                />
              ))}
          </div>)
      }
    }
  }

  function getDetailsLinkFromEventDetails(): ReactNode {
    const linkStyle = cn(buttonVariants({ variant: "outline" }), "justify-center w-fit font-display bg-neutral-800 border border-white hover:border-black rounded-md text-white hover:text-black rounded-md select-none")
    if ((eventType === "exception" && eventDetails.user_triggered === false && eventDetails.handled === false) || eventType === "anr") {
      return (
        <div className='px-4 pt-4'>
          <Link key={eventDetails.id} href={`/${teamId}/${eventType === "exception" ? 'crashes' : 'anrs'}/${appId}/${eventDetails.group_id}/${eventDetails.type + "@" + eventDetails.file_name}`} className={linkStyle}>View {eventType === "exception" ? 'Crash' : 'ANR'} Details</Link>
        </div>
      )
    }
    if (eventType === "trace") {
      return (
        <div className='px-4 pt-8 pb-4'>
          <Link key={eventDetails.id} href={`/${teamId}/traces/${appId}/${eventDetails.trace_id}`} className={linkStyle}>View Trace Details</Link>
        </div>
      )
    }
    if (eventType === "bug_report") {
      return (
        <div className='px-4 pt-8 pb-4'>
          <Link key={eventDetails.id} href={`/${teamId}/bug_reports/${appId}/${eventDetails.bug_report_id}`} className={linkStyle}>View Bug Report Details</Link>
        </div>
      )
    }
  }

  return (
    <div
      className="flex flex-col items-center bg-neutral-800 h-full selection:bg-yellow-200/50 font-display overflow-y-auto overscroll-y-contain break-words"
    >
      {getJsonLayoutSnapshotsFromEventDetails()}
      {getImageLayoutSnapshotsFromEventDetails()}
      {getDetailsLinkFromEventDetails()}
      {getBodyFromEventDetails()}
    </div>
  )
}