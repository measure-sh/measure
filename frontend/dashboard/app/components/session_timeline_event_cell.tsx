'use client'

import { formatDateToHumanReadableDateTime } from '../utils/time_utils'
import { formatToCamelCase } from '../utils/string_utils'

type SessionTimelineEventCellProps = {
  eventType: string
  eventDetails: any
  threadName: string
  timestamp: string
  index: number
  selected: boolean
  onClick: (index: number) => void
}

export default function SessionTimelineEventCell({
  eventType,
  eventDetails,
  threadName,
  timestamp,
  index,
  selected,
  onClick
}: SessionTimelineEventCellProps) {

  function getColorFromEventType() {
    if ((eventType === "exception" || eventType === "anr") && eventDetails.user_triggered === true) {
      return "bg-orange-300"
    }

    if (eventType === "exception" || eventType === "anr") {
      return "bg-red-300"
    }

    if (eventType === "bug_report") {
      return "bg-red-300"
    }

    if (eventType.includes("gesture")) {
      return "bg-emerald-300"
    }

    if (eventType === "navigation" || eventType === "screen_view") {
      return "bg-fuchsia-300"
    }

    if (eventType === "http") {
      return "bg-cyan-300"
    }

    if (eventType === "trace") {
      return "bg-pink-300"
    }

    if (eventType === "custom") {
      return "bg-purple-300"
    }

    return "bg-indigo-300"
  }

  function getTitleFromEventType() {
    if (eventType === "exception" || eventType === "anr") {
      return eventDetails.type + ": " + eventDetails.message
    }

    if (eventType === "bug_report") {
      const name = eventDetails.description ? eventDetails.description : eventDetails.bug_report_id
      return "Bug Report: " + name
    }

    if (eventType === "string") {
      return 'Log: ' + eventDetails.logLevel ? formatToCamelCase(eventDetails.logLevel) + ': ' + eventDetails.string : eventDetails.string
    }

    if (eventType === "gesture_long_click") {
      const name = eventDetails.target.includes(".") ? eventDetails.target.split('.').pop()! : eventDetails.target
      return 'Long Click: ' + name
    }

    if (eventType === "gesture_scroll") {
      const name = eventDetails.target.includes(".") ? eventDetails.target.split('.').pop()! : eventDetails.target
      return 'Scroll: ' + name
    }

    if (eventType === "gesture_click") {
      const name = eventDetails.target.includes(".") ? eventDetails.target.split('.').pop()! : eventDetails.target
      return 'Click: ' + name
    }

    if (eventType === "http") {
      return 'HTTP: ' + eventDetails.method.toUpperCase() + ' ' + eventDetails.status_code + ' ' + eventDetails.url
    }

    if (eventType === "lifecycle_activity") {
      const name = eventDetails.class_name.includes(".") ? eventDetails.class_name.split('.').pop()! : eventDetails.class_name
      return 'Activity ' + formatToCamelCase(eventDetails.type) + ': ' + name
    }

    if (eventType === "lifecycle_fragment") {
      const name = eventDetails.class_name.includes(".") ? eventDetails.class_name.split('.').pop()! : eventDetails.class_name
      return 'Fragment ' + formatToCamelCase(eventDetails.type) + ': ' + name
    }

    if (eventType === "lifecycle_view_controller") {
      return eventDetails.class_name + ': ' + eventDetails.type
    }

    if (eventType === "lifecycle_swift_ui") {
      return eventDetails.class_name + ': ' + eventDetails.type
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

    if (eventType === "screen_view") {
      return 'Screen View: ' + eventDetails.name
    }

    if (eventType === "trace") {
      return 'Trace start: ' + eventDetails.trace_name
    }

    if (eventType === "custom") {
      return eventDetails.name
    }

    return eventType
  }

  return (
    <button className={`group w-full px-2 py-4 outline-hidden font-display hover:bg-yellow-200 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${selected ? 'bg-neutral-800 text-white' : ''} hover:text-black`}
      onClick={() => onClick(index)}>
      <div className="flex flex-row items-center" id={`event-cell-title-${eventType}-${index}`}>
        <div className={`w-2 h-2 rounded-full ${getColorFromEventType()}`} />
        <div className="mx-1" />
        <p className='truncate w-72 text-left'>{getTitleFromEventType()}</p>
        <div className="mx-1" />
        <div className="flex grow" />
        <div className={`rounded-full border text-xs px-2 py-1 ${selected ? 'border-white' : 'border-black'} group-hover:border-black`}>{threadName}</div>
        <div className="mx-1" />
        <div className={`rounded-full border text-xs px-2 py-1 text-nowrap ${selected ? 'border-white' : 'border-black'} group-hover:border-black`}>{formatDateToHumanReadableDateTime(timestamp)}</div>
      </div>
    </button>
  )
}