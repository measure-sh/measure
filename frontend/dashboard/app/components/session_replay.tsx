"use client"

import React, { useEffect, useRef, useState } from 'react'
import { ResponsiveLine } from '@nivo/line'
import { emptySessionReplay } from '../api/api_calls'
import { formatChartFormatTimestampToHumanReadable, formatTimestampToChartFormat } from '../utils/time_utils'
import DropdownSelect, { DropdownSelectType } from './dropdown_select'
import { DateTime, Duration } from 'luxon'
import SessionReplayEventDetails from './session_replay_event_details'
import SessionReplayEventCell from './session_replay_event_cell'

interface SessionReplayProps {
  teamId: string
  appId: string
  sessionReplay: typeof emptySessionReplay
}

const SessionReplay: React.FC<SessionReplayProps> = ({ teamId, appId, sessionReplay }) => {

  const cpuData = sessionReplay.cpu_usage != null ? [
    {
      id: '% CPU Usage',
      data: sessionReplay.cpu_usage.map(item => ({
        x: formatTimestampToChartFormat(item.timestamp),
        y: item.value
      }))
    }
  ] : null

  const memoryData = sessionReplay.memory_usage != null ? [
    {
      id: 'Java Free Heap',
      data: sessionReplay.memory_usage.map(item => ({
        x: formatTimestampToChartFormat(item.timestamp),
        y: item.java_free_heap
      }))
    },
    {
      id: 'Java Max Heap',
      data: sessionReplay.memory_usage.map(item => ({
        x: formatTimestampToChartFormat(item.timestamp),
        y: item.java_max_heap
      }))
    },
    {
      id: 'Java Total Heap',
      data: sessionReplay.memory_usage.map(item => ({
        x: formatTimestampToChartFormat(item.timestamp),
        y: item.java_total_heap
      }))
    },
    {
      id: 'Native Free Heap',
      data: sessionReplay.memory_usage.map(item => ({
        x: formatTimestampToChartFormat(item.timestamp),
        y: item.native_free_heap
      }))
    },
    {
      id: 'Native Total Heap',
      data: sessionReplay.memory_usage.map(item => ({
        x: formatTimestampToChartFormat(item.timestamp),
        y: item.native_total_heap
      }))
    },
    {
      id: 'RSS',
      data: sessionReplay.memory_usage.map(item => ({
        x: formatTimestampToChartFormat(item.timestamp),
        y: item.rss
      }))
    },
    {
      id: 'Total PSS',
      data: sessionReplay.memory_usage.map(item => ({
        x: formatTimestampToChartFormat(item.timestamp),
        y: item.total_pss
      }))
    }
  ] : null

  function parseEventsThreadsAndEventTypesFromSessionReplay() {
    let events: { eventType: string, timestamp: string, thread: string, details: any }[] = []
    let threads = new Set<string>()
    let eventTypes = new Set<string>()

    Object.keys(sessionReplay.threads).forEach(item => (
      // @ts-ignore
      sessionReplay.threads[item].forEach((subItem: any) => {
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

    events.sort((a, b) => {
      const dateA = DateTime.fromISO(a.timestamp, { zone: 'utc' })
      const dateB = DateTime.fromISO(b.timestamp, { zone: 'utc' })

      return dateA.toMillis() - dateB.toMillis()
    })

    let threadsArray = Array.from(threads)
    let eventsTypesArray = Array.from(eventTypes)

    return { events, threads: threadsArray, eventTypes: eventsTypesArray }
  }

  const { events, threads, eventTypes } = parseEventsThreadsAndEventTypesFromSessionReplay()

  const seekBarOffset = 90
  const [seekbarXPosition, setSeekbarXPosition] = useState(seekBarOffset)
  const eventRefs = useRef<(HTMLDivElement | null)[]>([])
  const graphContainerRef = useRef<(HTMLDivElement | null)>(null)
  const eventListContainerRef = useRef<(HTMLDivElement | null)>(null)
  const [isSeeking, setIsSeeking] = useState(false)

  const [selectedThreads, setSelectedThreads] = useState(threads)
  const [selectedEventTypes, setSelectedEventTypes] = useState(eventTypes)
  const [filteredEvents, setFilteredEvents] = useState(events)
  const [selectedEventIndex, setSelectedEventIndex] = useState(0)

  const findClosestFilteredEventIndex = (timestamp: DateTime) => {
    return filteredEvents.reduce((prevIndex, currentEvent, currentIndex, arr) => {
      const closestDiff = Math.abs(DateTime.fromISO(filteredEvents[prevIndex].timestamp).diff(timestamp).toMillis())
      const currentDiff = Math.abs(DateTime.fromISO(currentEvent.timestamp).diff(timestamp).toMillis())

      return currentDiff < closestDiff ? currentIndex : prevIndex
    }, 0)
  }

  const scrollToEvent = (seekbarPosition: number) => {
    const totalGraphWidth = (graphContainerRef.current?.offsetWidth || 1) - seekBarOffset
    const adjustedSeekbarPosition = seekbarPosition - seekBarOffset

    const scrollPercentage = adjustedSeekbarPosition / totalGraphWidth

    const startTime = DateTime.fromISO(events[0].timestamp)
    const endTime = DateTime.fromISO(events[events.length - 1].timestamp)
    const duration = endTime.diff(startTime)
    const resultTimestamp = startTime.plus(Duration.fromMillis(duration.toMillis() * scrollPercentage))

    const eventIndexToScrollTo = findClosestFilteredEventIndex(resultTimestamp)
    const eventToScrollTo = eventRefs.current[eventIndexToScrollTo]

    if (eventToScrollTo && eventListContainerRef.current) {
      eventListContainerRef.current.scrollTo({
        top: eventToScrollTo.offsetTop - eventListContainerRef.current.offsetTop,
        behavior: 'auto',
      })
      setSelectedEventIndex(eventIndexToScrollTo)
    }
  }

  const handleSeekbarMove = (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isSeeking || !graphContainerRef.current) {
      return
    }

    let clientX: number

    if ('touches' in event) {
      // Handle TouchEvent
      clientX = event.touches[0].clientX
    } else {
      // Handle MouseEvent
      clientX = event.clientX
    }

    const boundingRect = graphContainerRef.current.getBoundingClientRect()
    let newSeekbarX = clientX - boundingRect.left

    if (newSeekbarX < seekBarOffset) {
      newSeekbarX = seekBarOffset
    } else {
      const containerWidth = boundingRect.width
      if (newSeekbarX > containerWidth) {
        newSeekbarX = containerWidth
      }
    }

    setSeekbarXPosition(newSeekbarX)
    scrollToEvent(newSeekbarX)
  }

  const selectEventAndMoveSeekBar = (eventIndex: number) => {
    if (!graphContainerRef.current) {
      return
    }

    const startTime = DateTime.fromISO(events[0].timestamp)
    const endTime = DateTime.fromISO(events[events.length - 1].timestamp)
    const duration = endTime.diff(startTime)
    const eventTime = DateTime.fromISO(filteredEvents[eventIndex].timestamp)
    const elapsedTime = eventTime.diff(startTime)
    const percentage = elapsedTime.toMillis() / duration.toMillis()
    const scrollPercentage = Math.max(0, Math.min(percentage, 1))

    // Adjust seekbar position based on scroll percentage
    const totalGraphWidth = graphContainerRef.current.offsetWidth - seekBarOffset
    const newSeekbarPosition = seekBarOffset + scrollPercentage * totalGraphWidth

    setSeekbarXPosition(newSeekbarPosition)
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

  const handleSeekbarMouseDown = () => {
    setIsSeeking(true)
  }

  const handleSeekbarMouseUpOrLeave = () => {
    setIsSeeking(false)
  }

  useEffect(() => {
    setFilteredEvents(events.filter((e) => selectedThreads.includes(e.thread) && selectedEventTypes.includes(e.eventType)))
    setSelectedEventIndex(0)
  }, [selectedThreads, selectedEventTypes])

  return (
    <div className="flex flex-col w-[1100px] font-sans text-black">
      {/* Graphs container */}
      <div className="relative mt-4"
        onMouseMove={handleSeekbarMove}
        onTouchMove={handleSeekbarMove}
        onMouseDown={handleSeekbarMouseDown}
        onTouchStart={handleSeekbarMouseDown}
        onMouseUp={handleSeekbarMouseUpOrLeave}
        onTouchEnd={handleSeekbarMouseUpOrLeave}
        onMouseLeave={handleSeekbarMouseUpOrLeave}
        ref={graphContainerRef}
      >
        {/* Memory line */}
        {memoryData != null &&
          <div className="h-48 select-none">
            <ResponsiveLine
              animate
              data={memoryData}
              curve="monotoneX"
              crosshairType="cross"
              margin={{ top: 40, right: 0, bottom: 80, left: 90 }}
              xFormat='time:%Y-%m-%d %H:%M:%S:%L %p'
              xScale={{
                format: '%Y-%m-%d %I:%M:%S:%L %p',
                precision: 'second',
                type: 'time',
                min: DateTime.fromISO(events[0].timestamp).toLocal().toJSDate(),
                max: DateTime.fromISO(events[events.length - 1].timestamp).toLocal().toJSDate(),
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
              useMesh={true}
              colors={{ scheme: 'nivo' }}
              defs={[
                {
                  colors: [
                    {
                      color: 'inherit',
                      offset: 0
                    },
                    {
                      color: 'inherit',
                      offset: 100,
                      opacity: 0
                    }
                  ],
                  id: 'memoryGradient',
                  type: 'linearGradient'
                }
              ]}
              enableSlices="x"
              enableCrosshair
              sliceTooltip={({ slice }) => {
                if (isSeeking) {
                  return null
                }
                return (
                  <div className="bg-neutral-950 text-white flex flex-col p-2 text-xs">
                    {slice.points.map((point) => (
                      <div className="flex flex-row items-center p-2" key={point.id}>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                        <div className="px-2" />
                        <p>{point.serieId}: {point.data.y.toString()} MB</p>
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
          <div className="h-48 select-none">
            <ResponsiveLine
              animate
              data={cpuData}
              curve="monotoneX"
              crosshairType="cross"
              margin={{ top: 40, right: 0, bottom: 80, left: 90 }}
              xFormat='time:%Y-%m-%d %I:%M:%S:%L %p'
              xScale={{
                format: '%Y-%m-%d %I:%M:%S:%L %p',
                precision: 'second',
                type: 'time',
                min: DateTime.fromISO(events[0].timestamp).toLocal().toJSDate(),
                max: DateTime.fromISO(events[events.length - 1].timestamp).toLocal().toJSDate(),
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
              useMesh={true}
              colors={{ scheme: 'nivo' }}
              defs={[
                {
                  colors: [
                    {
                      color: 'inherit',
                      offset: 0
                    },
                    {
                      color: 'inherit',
                      offset: 100,
                      opacity: 80
                    }
                  ],
                  id: 'cpuGradient',
                  type: 'linearGradient'
                }
              ]}
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
              fill={[
                {
                  id: 'cpuGradient',
                  match: '*'
                }
              ]}
              tooltip={({ point }) => {
                if (isSeeking) {
                  return null
                }
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
          className="absolute top-0 h-full flex flex-col items-center py-2"
          style={{ left: `${seekbarXPosition}px` }}>
          <div className='h-3 w-3 rounded-full bg-neutral-800' />
          <div className='h-full w-0.5 bg-neutral-800' />
          <div className='h-3 w-3  rounded-full bg-neutral-800' />
        </div>
      </div>
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
          {filteredEvents.map((e, index) => (
            <div key={index} className={""} ref={(el) => {
              eventRefs.current[index] = el
            }}>
              <SessionReplayEventCell eventType={e.eventType} eventDetails={e.details} timestamp={e.timestamp} threadName={e.thread} index={index} selected={index === selectedEventIndex} onClick={(index) => selectEventAndMoveSeekBar(index)} />
            </div>
          ))}
        </div>
        <div className='w-0.5 h-full bg-neutral-950' />
        <div className='h-full w-1/3'
        >
          <SessionReplayEventDetails teamId={teamId} appId={appId} eventType={filteredEvents[selectedEventIndex].eventType} eventDetails={filteredEvents[selectedEventIndex].details} />
        </div>
      </div>
    </div>
  )
}

export default SessionReplay