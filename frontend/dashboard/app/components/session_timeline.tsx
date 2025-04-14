"use client"

import React, { useEffect, useRef, useState } from 'react'
import { LineCanvas } from '@nivo/line'
import { emptySessionTimeline } from '../api/api_calls'
import { formatChartFormatTimestampToHumanReadable, formatTimestampToChartFormat } from '../utils/time_utils'
import { kilobytesToMegabytes } from '../utils/number_utils'
import DropdownSelect, { DropdownSelectType } from './dropdown_select'
import { DateTime, Duration } from 'luxon'

import { useScrollStop } from '../utils/scroll_utils'
import SessionTimelineSeekBar from './session_timeline_seekbar'
import SessionTimelineEventCell from './session_timeline_event_cell'
import SessionTimelineEventDetails from './session_timeline_event_details'

interface SessionTimelineProps {
  teamId: string
  appId: string
  sessionTimeline: typeof emptySessionTimeline
}

const SessionTimeline: React.FC<SessionTimelineProps> = ({ teamId, appId, sessionTimeline }) => {

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
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.java_free_heap).toFixed(2)
        }))
    },
    {
      id: 'Java Max Heap',
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.java_max_heap).toFixed(2)
        }))
    },
    {
      id: 'Java Total Heap',
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.java_total_heap).toFixed(2)
        }))
    },
    {
      id: 'Native Free Heap',
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.native_free_heap).toFixed(2)
        }))
    },
    {
      id: 'Native Total Heap',
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.native_total_heap).toFixed(2)
        }))
    },
    {
      id: 'RSS',
      data: sessionTimeline.memory_usage
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.rss).toFixed(2)
        }))
    },
    {
      id: 'Total PSS',
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
      data: sessionTimeline.memory_usage_absolute
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.max_memory).toFixed(2)
        }))
    },
    {
      id: 'Used Memory',
      data: sessionTimeline.memory_usage_absolute
        .filter(item => isWithinEventTimeRange(item.timestamp))
        .map(item => ({
          x: formatTimestampToChartFormat(item.timestamp),
          y: kilobytesToMegabytes(item.used_memory).toFixed(2)
        }))
    },
  ] : null

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
    // If no events, no need to select event or move seek bar
    if (!graphContainerRef.current || firstEventTime === null || lastEventTime === null) {
      return
    }

    const duration = lastEventTime.diff(firstEventTime)
    const eventTime = DateTime.fromISO(filteredEvents[eventIndex].timestamp)
    const elapsedTime = eventTime.diff(firstEventTime)
    const percentage = elapsedTime.toMillis() / duration.toMillis()
    const scrollPercentage = Math.max(0, Math.min(percentage, 1))

    setSeekBarValue(scrollPercentage * 100)
    setSelectedEventIndex(eventIndex)
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
    <div className="flex flex-col w-[1100px] font-body text-black">
      {/* Graphs container */}
      {(cpuData != null || memoryData != null || memoryAbsData != null) &&
        <div className="relative"
          ref={graphContainerRef}
        >
          {/* Memory line */}
          {memoryData != null &&
            <div className="select-none">
              <LineCanvas
                width={1100}
                height={200}
                data={memoryData}
                curve="monotoneX"
                crosshairType="cross"
                margin={{ top: 40, right: 0, bottom: 80, left: 90 }}
                xFormat='time:%Y-%m-%d %H:%M:%S:%L %p'
                xScale={{
                  format: '%Y-%m-%d %I:%M:%S:%L %p',
                  precision: 'second',
                  type: 'time',
                  min: events.length > 0 ? DateTime.fromISO(events[0].timestamp).toLocal().toJSDate() : "auto",
                  max: events.length > 0 ? DateTime.fromISO(events[events.length - 1].timestamp).toLocal().toJSDate() : "auto",
                  useUTC: false
                }}
                yScale={{
                  type: 'linear',
                  min: 0,
                  max: 'auto'
                }}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  format: '%-I:%M:%S %p',
                  legendPosition: 'middle',
                  tickRotation: 45
                }}
                axisLeft={{
                  tickSize: 1,
                  tickPadding: 5,
                  tickValues: 5,
                  legend: 'Memory in MB',
                  legendOffset: -80,
                  legendPosition: 'middle'
                }}
                colors={{ scheme: 'nivo' }}
                tooltip={({ point }) => {
                  return (
                    <div className='bg-neutral-950 text-white flex flex-row items-center p-2 text-xs'>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                      <div className="flex flex-col items-left px-4 py-1" key={point.id}>
                        <p>Time: {formatChartFormatTimestampToHumanReadable(point.data.xFormatted.toString())}</p>
                        <div className="py-0.5" />
                        <p>{point.serieId}: {point.data.y.toString()} MB</p>
                      </div>
                    </div>
                  )
                }}
              />
            </div>
          }
          {/* Memory Absolute line */}
          {memoryAbsData != null &&
            <div className="select-none">
              <LineCanvas
                width={1100}
                height={200}
                data={memoryAbsData}
                curve="monotoneX"
                crosshairType="cross"
                margin={{ top: 40, right: 0, bottom: 80, left: 90 }}
                xFormat='time:%Y-%m-%d %H:%M:%S:%L %p'
                xScale={{
                  format: '%Y-%m-%d %I:%M:%S:%L %p',
                  precision: 'second',
                  type: 'time',
                  min: events.length > 0 ? DateTime.fromISO(events[0].timestamp).toLocal().toJSDate() : "auto",
                  max: events.length > 0 ? DateTime.fromISO(events[events.length - 1].timestamp).toLocal().toJSDate() : "auto",
                  useUTC: false
                }}
                yScale={{
                  type: 'linear',
                  min: 0,
                  max: 'auto'
                }}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  format: '%-I:%M:%S %p',
                  legendPosition: 'middle',
                  tickRotation: 45
                }}
                axisLeft={{
                  tickSize: 1,
                  tickPadding: 5,
                  tickValues: 5,
                  legend: 'Memory in MB',
                  legendOffset: -80,
                  legendPosition: 'middle'
                }}
                colors={{ scheme: 'nivo' }}
                tooltip={({ point }) => {
                  return (
                    <div className='bg-neutral-950 text-white flex flex-row items-center p-2 text-xs'>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                      <div className="flex flex-col items-left px-4 py-1" key={point.id}>
                        <p>Time: {formatChartFormatTimestampToHumanReadable(point.data.xFormatted.toString())}</p>
                        <div className="py-0.5" />
                        <p>{point.serieId}: {point.data.y.toString()} MB</p>
                      </div>
                    </div>
                  )
                }}
              />
            </div>
          }
          {/* CPU line */}
          {cpuData != null &&
            <div className="select-none">
              <LineCanvas
                width={1100}
                height={200}
                data={cpuData}
                curve="monotoneX"
                crosshairType="cross"
                margin={{ top: 40, right: 0, bottom: 80, left: 90 }}
                xFormat='time:%Y-%m-%d %I:%M:%S:%L %p'
                xScale={{
                  format: '%Y-%m-%d %I:%M:%S:%L %p',
                  precision: 'second',
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
                  tickRotation: 45
                }}
                axisLeft={{
                  tickSize: 1,
                  tickPadding: 5,
                  tickValues: 5,
                  legend: '% CPU Usage',
                  legendOffset: -80,
                  legendPosition: 'middle'
                }}
                colors={{ scheme: 'nivo' }}
                enableArea
                enableCrosshair
                pointSize={5}
                pointBorderWidth={2}
                pointBorderColor={{
                  from: 'color',
                  modifiers: [
                    [
                      'darker',
                      0.3
                    ]
                  ]
                }}
                tooltip={({ point }) => {
                  return (
                    <div className='bg-neutral-950 text-white flex flex-col p-2 text-xs'>
                      <p>Time: {formatChartFormatTimestampToHumanReadable(point.data.xFormatted.toString())}</p>
                      <p>Cpu Usage: {point.data.yFormatted.toString()}%</p>
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
      <div className='flex flex-row mt-4 border border-black rounded-md w-full h-96'>
        <div className='h-full w-2/3 overflow-auto overscroll-y-contain divide-y' ref={eventListContainerRef}
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
        <div className='w-0.5 h-full bg-neutral-950' />
        <div className='h-full w-1/3'
        >
          {filteredEvents.length > 0 && <SessionTimelineEventDetails teamId={teamId} appId={appId} eventType={filteredEvents[selectedEventIndex].eventType} eventDetails={filteredEvents[selectedEventIndex].details} />}
        </div>
      </div>
    </div>
  )
}

export default SessionTimeline
