'use client'

import { useState, useEffect, ReactNode } from 'react'
import FilterPill from './filter_pill'
import { formatDateToHumanReadable, formatTimeToHumanReadable } from '../utils/time_utils'
import { formatToCamelCase } from '../utils/string_utils'
import Image from 'next/image';

type SessionReplayEventAccordionpProps = {
  eventType: string
  eventDetails: any
  threadName: string
  timestamp: string
  id: string
  active?: boolean
}

export default function SessionReplayEventAccordion({
  eventType,
  eventDetails,
  threadName,
  timestamp,
  id,
  active = false
}: SessionReplayEventAccordionpProps) {

  const [accordionOpen, setAccordionOpen] = useState<boolean>(false)

  useEffect(() => {
    setAccordionOpen(active)
  }, [])

  function getColorFromEventType() {
    if (eventType === "exception" || eventType === "anr") {
      return "bg-red-200 hover:bg-red-300 active:bg-red-400 focus-visible:outline-red-300"
    }

    if (eventType.includes("gesture")) {
      return "bg-emerald-200 hover:bg-emerald-300 active:bg-emerald-400 focus-visible:outline-emerald-300"
    }

    if (eventType === "navigation") {
      return "bg-fuchsia-200 hover:bg-fuchsia-300 active:bg-fuchsia-400 focus-visible:outline-fuchsia-300"
    }

    if (eventType === "http") {
      return "bg-orange-200 hover:bg-orange-300 active:bg-orange-400 focus-visible:outline-orange-300"
    }

    return "bg-indigo-200 hover:bg-indigo-300 active:bg-indigo-400 focus-visible:outline-indigo-300"
  }

  function getTitleFromEventType() {
    if (eventType === "exception" || eventType === "anr") {
      return eventDetails.title
    }

    if (eventType === "string") {
      return 'Log: ' + eventDetails.logLevel ? formatToCamelCase(eventDetails.logLevel) + ': ' + eventDetails.string : eventDetails.string
    }

    if (eventType === "gesture_long_click") {
      return 'Long Click: ' + eventDetails.target
    }

    if (eventType === "gesture_scroll") {
      return 'Scroll: ' + eventDetails.target
    }

    if (eventType === "gesture_click") {
      return 'Click: ' + eventDetails.target
    }

    if (eventType === "gesture_click") {
      return 'Click: ' + eventDetails.target
    }

    if (eventType === "http") {
      return 'HTTP: ' + eventDetails.method.toUpperCase() + ' ' + eventDetails.status_code + ' ' + eventDetails.url
    }

    if (eventType === "lifecycle_activity") {
      return 'Activity ' + formatToCamelCase(eventDetails.type) + ': ' + eventDetails.class_name
    }

    if (eventType === "lifecycle_fragment") {
      return 'Fragment ' + formatToCamelCase(eventDetails.type) + ': ' + eventDetails.class_name
    }

    if (eventType === "lifecycle_app") {
      return 'App ' + formatToCamelCase(eventDetails.type)
    }

    if (eventType === "app_exit") {
      return 'App Exit: ' + eventDetails.reason
    }

    if (eventType === "navigation") {
      return 'Navigation: ' + eventDetails.to
    }

    if (eventType === "cold_launch") {
      return 'App Cold Launch'
    }

    if (eventType === "warm_launch") {
      return 'App Warm Launch'
    }

    if (eventType === "hot_launch") {
      return 'App Hot Launch'
    }

    if (eventType === "low_memory") {
      return 'System: Low Memory'
    }

    if (eventType === "trim_memory") {
      return 'System: Trim Memory'
    }

    return eventType
  }

  function getBodyFromEventDetails(eventDetails: any): string {
    const entries = Object.entries(eventDetails);
    return entries.map(([key, value]): string => {
      if (typeof value === 'object' && value !== null) {
        if (Object.keys(value).length === 0) {
          return `${key}: --`;
        } else {
          return `${key}: ${getBodyFromEventDetails(value)}`;
        }
      } else if (value === '') {
        return `${key}: --`;
      } else if (key === 'stacktrace') {
        return `${key}: \n\t${(value as string).replace(/\n/g, '\n\t')}`;
      } else {
        return `${key}: ${value}`;
      }
    }).join('\n');
  }

  function getAttachmentsFromEventDetails(): ReactNode {
    if (eventDetails.attachments !== undefined && eventDetails.attachments !== null && eventDetails.attachments.length > 0) {
      // Return screenshots for exceptions
      if (eventType === 'exception' || eventType === 'anr') {
        return (
          <div className='flex flex-wrap gap-8 p-4 items-center'>
            {eventDetails.attachments.map((attachment: {
              key: string, location: string
            }, index: number) => (
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
          </div>)
      }
    }
  }

  return (
    <div className={`border border-black rounded-md`}>
      <button className={`w-full p-4 outline-none rounded-t-md ${!accordionOpen ? 'rounded-b-md' : ''} font-display ${getColorFromEventType()} `}
        onClick={(e) => { e.preventDefault(); setAccordionOpen(!accordionOpen); }}
      >
        <div className="flex flex-col md:flex-row items-center"
          id={`accordion-title-${id}`}>
          <p className='text-left'>{getTitleFromEventType()}</p>
          <div className="p-2" />
          <div className="flex grow" />
          <FilterPill title={threadName} />
          <div className="p-2" />
          <FilterPill title={`${formatDateToHumanReadable(timestamp)} \u25CF ${formatTimeToHumanReadable(timestamp)}`} />
        </div>
      </button>
      <div
        id={`accordion-text-${id}`}
        role="region"
        aria-labelledby={`accordion-title-${id}`}
        className={`bg-neutral-950 selection:bg-yellow-200/50 grid text-left text-sm font-sans overflow-hidden transition-all duration-300 ease-in-out ${accordionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden flex flex-col">
          {getAttachmentsFromEventDetails()}
          <p className="whitespace-pre-wrap p-4 text-white">
            {getBodyFromEventDetails(eventDetails)}
          </p>
        </div>
      </div>
    </div>
  )
}