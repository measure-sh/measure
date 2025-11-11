"use client"

import { ResponsiveLineCanvas } from '@nivo/line'
import { DateTime, Duration } from 'luxon'
import React, { useEffect, useRef, useState } from 'react'
import { emptySessionTimeline } from '../api/api_calls'
import { kilobytesToMegabytes } from '../utils/number_utils'
import { formatChartFormatTimestampToHumanReadable, formatTimestampToChartFormat } from '../utils/time_utils'
import DropdownSelect, { DropdownSelectType } from './dropdown_select'

import { useTheme } from 'next-themes'
import { useScrollStop } from '../utils/scroll_utils'
import SessionTimelineEventCell from './session_timeline_event_cell'
import SessionTimelineEventDetails from './session_timeline_event_details'
import SessionTimelineSeekBar from './session_timeline_seekbar'

const demoTimelineLastEventTime = DateTime.now().toUTC()
const demoTimeline: typeof emptySessionTimeline = {
  app_id: "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
  attribute: {
    installation_id: "1fefa265-9e6b-45d8-aa83-23b03070c06e",
    app_version: "2.0.0",
    app_build: "200",
    app_unique_id: "sh.measure.sample",
    measure_sdk_version: "1.0.0",
    platform: "android",
    thread_name: "msr-default",
    user_id: "dummy-user-id",
    device_name: "sunfish",
    device_model: "Pixel 7 Pro",
    device_manufacturer: "Google",
    device_type: "phone",
    device_is_foldable: false,
    device_is_physical: true,
    device_density_dpi: 440,
    device_width_px: 1080,
    device_height_px: 2138,
    device_density: 2.75,
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
  cpu_usage: [
    { timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).toISO(), value: 5 },
    { timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 3 }).toISO(), value: 15.625 },
    { timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 6 }).toISO(), value: 12.314 },
    { timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 9 }).toISO(), value: 35.742 },
    { timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 12 }).toISO(), value: 38.923 },
  ],
  duration: 150000,
  memory_usage: [
    {
      java_max_heap: 262144,
      java_total_heap: 262144,
      java_free_heap: 259685,
      total_pss: 10846,
      rss: 105040,
      native_total_heap: 12612,
      native_free_heap: 1170,
      interval: 0,
      timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).toISO()
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 58687,
      total_pss: 57496,
      rss: 135104,
      native_total_heap: 17752,
      native_free_heap: 1259,
      interval: 2056,
      timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 3 }).toISO()
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 58391,
      total_pss: 57572,
      rss: 135240,
      native_total_heap: 17752,
      native_free_heap: 1229,
      interval: 2043,
      timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 6 }).toISO()
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 57931,
      total_pss: 59015,
      rss: 136396,
      native_total_heap: 18520,
      native_free_heap: 1314,
      interval: 2055,
      timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 9 }).toISO()
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 57162,
      total_pss: 59904,
      rss: 137996,
      native_total_heap: 19544,
      native_free_heap: 1307,
      interval: 2032,
      timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 12 }).toISO()
    }
  ],
  memory_usage_absolute: null,
  session_id: "81f06f23-4291-4590-a5df-c96d57d3c692",
  threads: {
    main: [
      { event_type: "hot_launch", user_defined_attribute: null, thread_name: "main", duration: 28, timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).toISO() },
      { event_type: "lifecycle_app", user_defined_attribute: null, thread_name: "main", type: "foreground", timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ milliseconds: 43 }).toISO() },
      { event_type: "lifecycle_activity", user_defined_attribute: null, thread_name: "main", type: "resumed", class_name: "sh.measure.demo.CheckoutActivity", timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ milliseconds: 91 }).toISO() },
      { event_type: "custom", user_defined_attribute: { payment_methods: "{\"payment_methods\":[{\"name\": \"personal\", \"type\":\"credit_card\", \"currency\": \"GBP\", \"balance\": 1000}]}" }, thread_name: "main", user_triggered: true, name: "Payment Methods Fetched", timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 1 }).toISO() },
      {
        event_type: "gesture_click", user_defined_attribute: null, thread_name: "main", target: "com.google.android.material.button.MaterialButton", target_id: "btn_discount_1", width: 125, height: 200, x: 102, y: 403, timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 6 }).toISO(), "attachments": [
          {
            "id": "125df6e5-1e45-4380-bcc6-8c13e50439f8",
            "name": "snapshot.svg",
            "type": "layout_snapshot_json",
            "key": "demo_snapshot_discount_click",
            "location": "/snapshots/demo_snapshot_discount_click.json"
          }
        ]
      },
      {
        event_type: "gesture_click", user_defined_attribute: null, thread_name: "main", target: "com.google.android.material.button.MaterialButton", target_id: "btn_pay", width: 1080, height: 200, x: 125, y: 1674, timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 13 }).toISO(), "attachments": [
          {
            "id": "125df6e5-1e45-4380-bcc6-8c13e50439f8",
            "name": "snapshot.svg",
            "type": "layout_snapshot_json",
            "key": "demo_snapshot_pay_click",
            "location": "/snapshots/demo_snapshot_pay_click.json"
          }
        ]
      },
      { event_type: "exception", user_defined_attribute: null, user_triggered: false, group_id: "9b71282275e88a68b38fe69a1bda0ea7", type: "java.lang.IllegalStateException", message: "Payment method must be specified", method_name: "onClick", file_name: "CheckoutActivity.kt", line_number: 102, thread_name: "main", handled: false, timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 13 }).toISO(), stacktrace: "java.lang.IllegalStateException: Payment method must be specified\n\tat MaterialButton.onClick(CheckoutActivity.kt:102)" }
    ],
    "okhttp": [
      {
        "event_type": "http",
        "user_defined_attribute": null,
        "thread_name": "okhttp",
        "user_triggered": false,
        "url": "https://payments.demo-provider.com/demo-user-id/payment-methods",
        "method": "GET",
        "status_code": 200,
        "request_body": "",
        "response_body": "{\"payment_methods\":[{\"name\": \"personal\", \"type\":\"credit_card\", \"currency\": \"GBP\", \"balance\": 1000}]}",
        "failure_reason": "",
        "failure_description": "",
        "client": "okhttp",
        "duration": 742,
        "timestamp": demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ milliseconds: 143 }).toISO()
      }
    ],
  },
  traces: [
    {
      "trace_id": "14f94d4e346a4bb36cf7eb06dae727ff",
      "trace_name": "CheckoutActivity Time to Full Display",
      "thread_name": "main",
      "start_time": demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ milliseconds: 43 }).toISO(),
      "end_time": demoTimelineLastEventTime.minus({ minutes: 7.5 }).plus({ seconds: 1, milliseconds: 230 }).toISO(),
      "duration": 1187
    },
  ]
} as any

interface SessionTimelineProps {
  teamId?: string
  appId?: string
  sessionTimeline?: typeof emptySessionTimeline
  demo?: boolean
  hideDemoTitle?: boolean
}

const SessionTimeline: React.FC<SessionTimelineProps> = ({ teamId = 'demo-team', appId = 'demo-app', sessionTimeline = demoTimeline, demo = false, hideDemoTitle = false }) => {
  const { theme } = useTheme()

  // Since we use canvas charts here, we can't use CSS variables and have to hardcode colors based on theme.
  // These colors should be the same as --foreground for each theme in globals.css
  const canvasChartTheme = {
    text: {
      fill: theme === 'dark' ? 'oklch(0.985 0 0)' : 'oklch(0.141 0.005 285.823)',
    },
    axis: {
      ticks: {
        text: {
          fill: theme === 'dark' ? 'oklch(0.985 0 0)' : 'oklch(0.141 0.005 285.823)',
        },
      },
    },
    legends: {
      text: {
        fill: theme === 'dark' ? 'oklch(0.985 0 0)' : 'oklch(0.141 0.005 285.823)',
      },
    },
  };

  function parseEventsThreadsAndEventTypesFromSessionTimeline() {
    let events: { eventType: string, timestamp: string, thread: string, details: any }[] = []
    let threads = new Set<string>()
    let eventTypes = new Set<string>()
    const traceEventType = "trace"

    Object.keys(sessionTimeline.threads).forEach(item => (
      // @ts-ignore
      sessionTimeline.threads[item].forEach((subItem: any) => {
        events.push({
          eventType: subItem.event_type,
          timestamp: subItem.timestamp,
          thread: item,
          details: subItem
        })
        threads.add(item)
        eventTypes.add(subItem.event_type)
      })
    ))

    if (sessionTimeline.traces !== null) {
      eventTypes.add(traceEventType)
      sessionTimeline.traces.forEach((item: any) => {
        events.push({
          eventType: traceEventType,
          timestamp: item.start_time,
          thread: item.thread_name,
          details: item
        })

        threads.add(item.thread_name)
      })
    }

    events.sort((a, b) => {
      const dateA = DateTime.fromISO(a.timestamp, { zone: 'utc' })
      const dateB = DateTime.fromISO(b.timestamp, { zone: 'utc' })

      return dateA.toMillis() - dateB.toMillis()
    })

    let threadsArray = Array.from(threads)
    let eventsTypesArray = Array.from(eventTypes)

    return { events, threads: threadsArray, eventTypes: eventsTypesArray }
  }

  const { events, threads, eventTypes } = parseEventsThreadsAndEventTypesFromSessionTimeline()

  const firstEventTime = events.length > 0 ? DateTime.fromISO(events[0].timestamp) : null
  const lastEventTime = events.length > 0 ? DateTime.fromISO(events[events.length - 1].timestamp) : null

  function isWithinEventTimeRange(timestamp: string): boolean {
    // If no events, consider it as within range
    if (firstEventTime == null || lastEventTime == null) {
      return true
    }
    const time = DateTime.fromISO(timestamp)
    if (time >= firstEventTime && time <= lastEventTime) {
      return true
    }
    return false
  }

  const cpuData = sessionTimeline.cpu_usage != null ? [
    {
      id: '% CPU Usage',
      data: sessionTimeline.cpu_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: item.value
        }))
    }
  ] : null

  const memoryData = sessionTimeline.memory_usage != null ? [
    {
      id: 'Java Free Heap',
      serieColor: theme === 'dark' ? '#bb8d5f' : '#e8c1a0',
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.java_free_heap).toFixed(2)
        }))
    },
    {
      id: 'Java Max Heap',
      serieColor: theme === 'dark' ? '#e16615' : '#f47560',
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.java_max_heap).toFixed(2)
        }))
    },
    {
      id: 'Java Total Heap',
      serieColor: theme === 'dark' ? '#dca100' : '#f1e15b',
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.java_total_heap).toFixed(2)
        }))
    },
    {
      id: 'Native Free Heap',
      serieColor: theme === 'dark' ? '#cf8321' : '#e8a838',
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.native_free_heap).toFixed(2)
        }))
    },
    {
      id: 'Native Total Heap',
      serieColor: theme === 'dark' ? '#01956f' : '#61cdbb',
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.native_total_heap).toFixed(2)
        }))
    },
    {
      id: 'RSS',
      serieColor: theme === 'dark' ? '#33a293' : '#97e3d5',
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.rss).toFixed(2)
        }))
    },
    {
      id: 'Total PSS',
      serieColor: theme === 'dark' ? '#d4007a' : '#f7c6c7',
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.total_pss).toFixed(2)
        }))
    }
  ] : null

  const memoryAbsData = sessionTimeline.memory_usage_absolute != null ? [
    {
      id: 'Max Memory',
      serieColor: theme === 'dark' ? '#bb8d5f' : '#e8c1a0',
      data: sessionTimeline.memory_usage_absolute
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.max_memory).toFixed(2)
        }))
    },
    {
      id: 'Used Memory',
      serieColor: theme === 'dark' ? '#e16615' : '#f47560',
      data: sessionTimeline.memory_usage_absolute
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.used_memory).toFixed(2)
        }))
    },
  ] : null

  function roundUpToNiceMemoryValue(memory: number): number {
    if (memory < 1000) {
      return Math.ceil(memory / 100) * 100
    } else if (memory < 1_000_000) {
      return Math.ceil(memory / 1000) * 1000
    } else if (memory < 1_000_000_000) {
      return Math.ceil(memory / 1_000_000) * 1_000_000
    } else {
      return Math.ceil(memory / 1_000_000_000) * 1_000_000_000
    }
  }

  let maxMemoryDataValue = 0
  const createMemoryDataLookup = () => {
    if (!memoryData) return null

    const lookup = new Map()
    maxMemoryDataValue = 0 // Reset before calculation

    const filteredMemoryUsage = sessionTimeline.memory_usage.filter(item => isWithinEventTimeRange(item.timestamp))
    filteredMemoryUsage.forEach((item) => {
      const formattedTimestamp = formatTimestampToChartFormat(item.timestamp)
      const values = {
        'Java Free Heap': kilobytesToMegabytes(item.java_free_heap).toFixed(2),
        'Java Max Heap': kilobytesToMegabytes(item.java_max_heap).toFixed(2),
        'Java Total Heap': kilobytesToMegabytes(item.java_total_heap).toFixed(2),
        'Native Free Heap': kilobytesToMegabytes(item.native_free_heap).toFixed(2),
        'Native Total Heap': kilobytesToMegabytes(item.native_total_heap).toFixed(2),
        'RSS': kilobytesToMegabytes(item.rss).toFixed(2),
        'Total PSS': kilobytesToMegabytes(item.total_pss).toFixed(2)
      }

      for (const val of Object.values(values)) {
        const numVal = parseFloat(val)
        if (numVal > maxMemoryDataValue) {
          maxMemoryDataValue = numVal
        }
      }

      lookup.set(formattedTimestamp, values)
    })

    maxMemoryDataValue = roundUpToNiceMemoryValue(maxMemoryDataValue)

    return lookup
  }

  const memoryDataLookup = createMemoryDataLookup()

  let maxMemoryAbsDataValue = 0
  const createMemoryAbsDataLookup = () => {
    if (!memoryAbsData) return null

    const lookup = new Map()
    maxMemoryAbsDataValue = 0 // Reset before calculation

    const filteredMemoryUsage = sessionTimeline.memory_usage_absolute.filter(item => isWithinEventTimeRange(item.timestamp))
    filteredMemoryUsage.forEach((item) => {
      const formattedTimestamp = formatTimestampToChartFormat(item.timestamp)
      const values = {
        'Max Memory': kilobytesToMegabytes(item.max_memory).toFixed(2),
        'Used Memory': kilobytesToMegabytes(item.used_memory).toFixed(2)
      }

      for (const val of Object.values(values)) {
        const numVal = parseFloat(val)
        if (numVal > maxMemoryAbsDataValue) {
          maxMemoryAbsDataValue = numVal
        }
      }

      lookup.set(formattedTimestamp, values)
    })

    maxMemoryAbsDataValue = roundUpToNiceMemoryValue(maxMemoryAbsDataValue)

    return lookup
  }

  const memoryAbsDataLookup = createMemoryAbsDataLookup()

  const seekBarIndicatorOffset = 90
  const [seekBarValue, setSeekBarValue] = useState(0)
  const eventRefs = useRef<(HTMLDivElement | null)[]>([])
  const graphContainerRef = useRef<(HTMLDivElement | null)>(null)
  const eventListContainerRef = useRef<(HTMLDivElement | null)>(null)

  const [selectedThreads, setSelectedThreads] = useState(threads)
  const [selectedEventTypes, setSelectedEventTypes] = useState(eventTypes)
  const [filteredEvents, setFilteredEvents] = useState(events)
  const [selectedEventIndex, setSelectedEventIndex] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)


  const findClosestFilteredEventIndex = (timestamp: DateTime) => {
    return filteredEvents.reduce((prevIndex, currentEvent, currentIndex, arr) => {
      const closestDiff = Math.abs(DateTime.fromISO(filteredEvents[prevIndex].timestamp).diff(timestamp).toMillis())
      const currentDiff = Math.abs(DateTime.fromISO(currentEvent.timestamp).diff(timestamp).toMillis())

      return currentDiff < closestDiff ? currentIndex : prevIndex
    }, 0)
  }

  const scrollToEvent = (seekBarValue: number) => {
    // If no events, no need to scroll
    if (firstEventTime === null || lastEventTime === null) {
      return
    }
    const duration = lastEventTime.diff(firstEventTime)
    const resultTimestamp = firstEventTime.plus(Duration.fromMillis(duration.toMillis() * seekBarValue / 100))

    const eventIndexToScrollTo = findClosestFilteredEventIndex(resultTimestamp)
    const eventToScrollTo = eventRefs.current[eventIndexToScrollTo]

    if (eventToScrollTo && eventListContainerRef.current) {
      eventListContainerRef.current.scrollTo({
        top: eventToScrollTo.offsetTop - eventListContainerRef.current.offsetTop,
        behavior: 'smooth',
      })
      setSelectedEventIndex(eventIndexToScrollTo)
    }
  }

  const handleSeekbarMove = (value: number) => {
    setIsSeeking(true)
    setSeekBarValue(value)
    scrollToEvent(value)
  }

  const selectEventAndMoveSeekBar = (eventIndex: number) => {
    setSelectedEventIndex(eventIndex)

    // If no events, no need to move seek bar
    if (!graphContainerRef.current || firstEventTime === null || lastEventTime === null) {
      return
    }

    const duration = lastEventTime.diff(firstEventTime)
    const eventTime = DateTime.fromISO(filteredEvents[eventIndex].timestamp)
    const elapsedTime = eventTime.diff(firstEventTime)
    const percentage = elapsedTime.toMillis() / duration.toMillis()
    const scrollPercentage = Math.max(0, Math.min(percentage, 1))

    setSeekBarValue(scrollPercentage * 100)
  }

  const handleEventsScroll = () => {
    if (isSeeking || !eventListContainerRef.current || eventRefs.current.length === 0 || !graphContainerRef.current) {
      return
    }

    // Get the scroll position and the container's height and top offset
    const containerScrollTop = eventListContainerRef.current.scrollTop
    const containerHeight = eventListContainerRef.current.clientHeight
    const containerOffsetTop = eventListContainerRef.current.offsetTop

    // Calculate the middle of the visible container
    const containerMiddle = containerScrollTop + containerHeight / 2

    // Find the event that is closest to the middle of the visible container
    let closestEventIndex = 0
    let closestEventDistance = Infinity

    eventRefs.current.forEach((eventRef, index) => {
      if (eventRef) {
        const eventOffsetTop = eventRef.offsetTop
        const distanceFromMiddle = Math.abs(containerMiddle - (eventOffsetTop - containerOffsetTop))
        if (distanceFromMiddle < closestEventDistance) {
          closestEventDistance = distanceFromMiddle
          closestEventIndex = index
        }
      }
    })

    selectEventAndMoveSeekBar(closestEventIndex)
  }

  useEffect(() => {
    setFilteredEvents(events.filter((e) => selectedThreads.includes(e.thread) && selectedEventTypes.includes(e.eventType)))
    setSelectedEventIndex(0)
  }, [selectedThreads, selectedEventTypes])

  useScrollStop(eventListContainerRef, () => {
    setIsSeeking(false)
  })

  return (
    <div className={`flex flex-col w-full font-body`}>
      {demo && !hideDemoTitle &&
        <>
          <p className="font-display text-4xl max-w-6xl text-start">Session Timeline</p>
          <div className="py-4" />
        </>
      }
      {/* Graphs container */}
      {(cpuData != null || memoryData != null || memoryAbsData != null) &&
        <div className="relative"
          ref={graphContainerRef}
        >
          {/* Memory line */}
          {memoryData != null &&
            <div className="select-none w-full h-[200px]">
              <ResponsiveLineCanvas
                data={memoryData}
                curve="monotoneX"
                theme={canvasChartTheme}
                crosshairType="cross"
                margin={{ top: 40, right: 0, bottom: 80, left: 90 }}
                xFormat='time:%Y-%m-%d %H:%M:%S:%L %p'
                xScale={{
                  format: '%Y-%m-%d %I:%M:%S:%L %p',
                  precision: 'millisecond',
                  type: 'time',
                  min: events.length > 0 ? DateTime.fromISO(events[0].timestamp).toLocal().toJSDate() : "auto",
                  max: events.length > 0 ? DateTime.fromISO(events[events.length - 1].timestamp).toLocal().toJSDate() : "auto",
                  useUTC: false
                }}
                yScale={{
                  type: 'linear',
                  min: 0,
                  max: maxMemoryDataValue
                }}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  format: '%-I:%M:%S %p',
                  legendPosition: 'middle',
                  tickRotation: 70
                }}
                axisLeft={{
                  tickSize: 1,
                  tickPadding: 5,
                  tickValues: 5,
                  legend: 'Memory in MB',
                  legendOffset: -80,
                  legendPosition: 'middle'
                }}
                colors={{ datum: 'serieColor' }}
                pointSize={6}
                pointBorderWidth={1.5}
                pointColor={theme === 'dark' ? "rgba(0, 0, 0, 255)" : "rgba(255, 255, 255, 255)"}
                pointBorderColor={{
                  from: 'serieColor',
                  modifiers: [
                    [
                      'darker',
                      0.3
                    ]
                  ]
                }}
                enableGridX={false}
                enableGridY={false}
                tooltip={({ point }) => {
                  if (!memoryDataLookup) return null

                  const formattedTimestamp = point.data.xFormatted
                  const allMemoryData = memoryDataLookup.get(formattedTimestamp) || {}

                  return (
                    <div className='bg-accent text-accent-foreground flex flex-col p-4 text-xs rounded-md'>
                      <p>Time: {formatChartFormatTimestampToHumanReadable(point.data.xFormatted.toString())}</p>
                      <div className="py-1" />
                      {Object.entries(allMemoryData).map(([seriesName, value]) => (
                        <div key={seriesName} className="flex flex-row items-center gap-2 mt-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: memoryData.find((it) => it.id === seriesName)!.serieColor }} />
                          <p>{seriesName}: {value as string} MB</p>
                        </div>
                      ))}
                    </div>
                  )
                }}
              />
            </div>
          }
          {/* Memory Absolute line */}
          {memoryAbsData != null &&
            <div className="select-none w-full h-[200px]">
              <ResponsiveLineCanvas
                data={memoryAbsData}
                curve="monotoneX"
                theme={canvasChartTheme}
                crosshairType="cross"
                margin={{ top: 40, right: 0, bottom: 80, left: 90 }}
                xFormat='time:%Y-%m-%d %H:%M:%S:%L %p'
                xScale={{
                  format: '%Y-%m-%d %I:%M:%S:%L %p',
                  precision: 'millisecond',
                  type: 'time',
                  min: events.length > 0 ? DateTime.fromISO(events[0].timestamp).toLocal().toJSDate() : "auto",
                  max: events.length > 0 ? DateTime.fromISO(events[events.length - 1].timestamp).toLocal().toJSDate() : "auto",
                  useUTC: false
                }}
                yScale={{
                  type: 'linear',
                  min: 0,
                  max: maxMemoryAbsDataValue
                }}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  format: '%-I:%M:%S %p',
                  legendPosition: 'middle',
                  tickRotation: 70
                }}
                axisLeft={{
                  tickSize: 1,
                  tickPadding: 5,
                  tickValues: 5,
                  legend: 'Memory in MB',
                  legendOffset: -80,
                  legendPosition: 'middle'
                }}
                colors={{ datum: 'serieColor' }}
                pointSize={6}
                pointBorderWidth={1.5}
                pointColor={theme === 'dark' ? "rgba(0, 0, 0, 255)" : "rgba(255, 255, 255, 255)"}
                pointBorderColor={{
                  from: 'serieColor',
                  modifiers: [
                    [
                      'darker',
                      0.3
                    ]
                  ]
                }}
                enableGridX={false}
                enableGridY={false}
                tooltip={({ point }) => {
                  if (!memoryAbsDataLookup) return null

                  const formattedTimestamp = point.data.xFormatted
                  const allMemoryData = memoryAbsDataLookup.get(formattedTimestamp) || {}

                  return (
                    <div className='bg-accent text-accent-foreground flex flex-col p-4 text-xs rounded-md'>
                      <p>Time: {formatChartFormatTimestampToHumanReadable(point.data.xFormatted.toString())}</p>
                      <div className="py-1" />
                      {Object.entries(allMemoryData).map(([seriesName, value]) => (
                        <div key={seriesName} className="flex flex-row items-center gap-2 mt-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: memoryAbsData.find((it) => it.id === seriesName)!.serieColor }} />
                          <p>{seriesName}: {value as string} MB</p>
                        </div>
                      ))}
                    </div>
                  )
                }}
              />
            </div>
          }
          {/* CPU line */}
          {cpuData != null &&
            <div className="select-none w-full h-[200px]">
              <ResponsiveLineCanvas
                data={cpuData}
                curve="monotoneX"
                theme={canvasChartTheme}
                crosshairType="cross"
                margin={{ top: 40, right: 0, bottom: 80, left: 90 }}
                xFormat='time:%Y-%m-%d %I:%M:%S:%L %p'
                xScale={{
                  format: '%Y-%m-%d %I:%M:%S:%L %p',
                  precision: 'millisecond',
                  type: 'time',
                  min: events.length > 0 ? DateTime.fromISO(events[0].timestamp).toLocal().toJSDate() : "auto",
                  max: events.length > 0 ? DateTime.fromISO(events[events.length - 1].timestamp).toLocal().toJSDate() : "auto",
                  useUTC: false
                }}
                yScale={{
                  type: 'linear',
                  min: 0,
                  max: 100
                }}
                yFormat=" >-.2f"
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  format: '%-I:%M:%S %p',
                  legendPosition: 'middle',
                  tickRotation: 70
                }}
                axisLeft={{
                  tickSize: 1,
                  tickPadding: 5,
                  tickValues: 5,
                  legend: '% CPU Usage',
                  legendOffset: -80,
                  legendPosition: 'middle'
                }}
                colors={{ scheme: theme === 'dark' ? 'tableau10' : 'nivo' }}
                pointSize={6}
                pointBorderWidth={1.5}
                pointColor={theme === 'dark' ? "rgba(0, 0, 0, 255)" : "rgba(255, 255, 255, 255)"}
                pointBorderColor={{
                  from: 'serieColor',
                  modifiers: [
                    [
                      'darker',
                      0.3
                    ]
                  ]
                }}
                enableGridX={false}
                enableGridY={false}
                tooltip={({ point }) => {
                  return (
                    <div className='bg-accent text-accent-foreground flex flex-col p-2 text-xs rounded-md'>
                      <p>Time: {formatChartFormatTimestampToHumanReadable(point.data.xFormatted.toString())}</p>
                      <div className="flex flex-row items-center gap-2 mt-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                        <p>Cpu Usage: {point.data.yFormatted.toString()}%</p>
                      </div>
                    </div>
                  )
                }}
              />
            </div>
          }
          {/* Vertical Seekbar */}
          <div
            className="w-full py-2" style={{ paddingLeft: `${seekBarIndicatorOffset}px` }}>
            <SessionTimelineSeekBar value={seekBarValue} onChange={handleSeekbarMove} />
          </div>
        </div>}
      {/* Event filters */}
      <div className="flex flex-wrap gap-8 items-center mt-4">
        <DropdownSelect type={DropdownSelectType.MultiString} title="Threads" items={threads} initialSelected={selectedThreads} onChangeSelected={(items) => setSelectedThreads(items as string[])} />
        <DropdownSelect type={DropdownSelectType.MultiString} title="Event types" items={eventTypes} initialSelected={selectedEventTypes} onChangeSelected={(items) => setSelectedEventTypes(items as string[])} />
      </div>
      {/* Events*/}
      <div className='flex flex-row mt-4 border border-border rounded-md w-full h-[600px]'>
        <div className='h-full w-2/3 overflow-auto divide-y' ref={eventListContainerRef}
          onScroll={handleEventsScroll}
        >
          {filteredEvents.length > 0 && filteredEvents.map((e, index) => (
            <div key={index} className={""} ref={(el) => {
              eventRefs.current[index] = el
            }}>
              <SessionTimelineEventCell eventType={e.eventType} eventDetails={e.details} timestamp={e.timestamp} threadName={e.thread} index={index} selected={index === selectedEventIndex} onClick={(index) => selectEventAndMoveSeekBar(index)} />
            </div>
          ))}
        </div>
        <div className='w-0.5 h-full bg-border' />
        <div className='h-full w-1/3'
        >
          {filteredEvents.length > 0 && <SessionTimelineEventDetails demo={demo} teamId={teamId} appId={appId} eventType={filteredEvents[selectedEventIndex].eventType} eventDetails={filteredEvents[selectedEventIndex].details} />}
        </div>
      </div>
    </div>
  )
}

export default SessionTimeline
