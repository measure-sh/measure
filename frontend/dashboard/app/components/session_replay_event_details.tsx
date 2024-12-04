'use client'

import { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type SessionReplayEventDetailsProps = {
  teamId: string
  appId: string
  eventType: string
  eventDetails: any
}

export default function SessionReplayEventDetails({
  teamId,
  appId,
  eventType,
  eventDetails
}: SessionReplayEventDetailsProps) {

  function getBodyFromEventDetails(eventDetails: any): ReactNode {
    const entries = Object.entries(eventDetails).filter(([key]) => key !== "user_defined_attribute")
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
          } else if (value === "" || value === null || typeof value === "object") {
            return null // Skip empty or invalid values
          } else {
            return (
              <div className="flex flex-row" key={key}>
                <p className={keyStyle}>{key}</p>
                <p className={valueStyle}>{value?.toString()}</p>
              </div>
            )
          }
        })}

        {userDefinedAttributes !== undefined && userDefinedAttributes !== null && (
          <div key="user_defined_attribute">
            {Object.entries(userDefinedAttributes).map(([attrKey, attrValue]) => (
              <div className="flex flex-row" key={attrKey}>
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
      // Return screenshots for exceptions
      if ((eventType === "exception" && eventDetails.user_triggered === false) || eventType === 'anr' || eventType === 'gesture_click') {
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

  return (
    <div
      className="flex flex-col items-center bg-neutral-800 h-full selection:bg-yellow-200/50 font-display overflow-y-auto overscroll-y-contain break-words"
    >
      {getAttachmentsFromEventDetails()}
      {getExceptionOverviewLinkFromEventDetails()}
      {getBodyFromEventDetails(eventDetails)}
    </div>
  )
}