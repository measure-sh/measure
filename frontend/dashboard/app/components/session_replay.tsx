"use client"

import React, { useState } from 'react'
import { ResponsiveLine } from '@nivo/line'
import { emptySessionReplay } from '../api/api_calls'
import SessionReplayEventAccordion from './session_replay_event_accordion'
import SessionReplayEventVerticalConnector from './session_replay_event_vertical_connector'
import { formatChartFormatTimestampToHumanReadable, formatTimestampToChartFormat } from '../utils/time_utils'
import DropdownSelect, { DropdownSelectType } from './dropdown_select'
import { DateTime } from 'luxon'

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
    let events: { eventType: string; timestamp: string; thread: string; details: any; }[] = []
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

  const [selectedThreads, setSelectedThreads] = useState(threads)
  const [selectedEventTypes, setSelectedEventTypes] = useState(eventTypes)

  return (
    <div className="flex flex-col w-screen font-sans text-black">
      {/* Memory line */}
      {memoryData != null &&
        <div className="h-96">
          <ResponsiveLine
            animate
            data={memoryData}
            curve="monotoneX"
            crosshairType="cross"
            margin={{ top: 40, right: 160, bottom: 80, left: 90 }}
            xFormat='time:%Y-%m-%d %H:%M:%S:%L %p'
            xScale={{
              format: '%Y-%m-%d %I:%M:%S:%L %p',
              precision: 'second',
              type: 'time',
              min: 'auto',
              max: 'auto',
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
            enableArea
            enableSlices="x"
            enableCrosshair
            fill={[
              {
                id: 'memoryGradient',
                match: '*'
              }
            ]}
            sliceTooltip={({ slice }) => {
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
        <div className="h-96">
          <ResponsiveLine
            animate
            data={cpuData}
            curve="monotoneX"
            crosshairType="cross"
            margin={{ top: 40, right: 160, bottom: 80, left: 90 }}
            xFormat='time:%Y-%m-%d %I:%M:%S:%L %p'
            xScale={{
              format: '%Y-%m-%d %I:%M:%S:%L %p',
              precision: 'second',
              type: 'time',
              min: 'auto',
              max: 'auto',
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
      {/* Events*/}
      <div>
        <div className="py-4" />
        <p className="font-sans text-3xl"> Events</p>
        <div className="py-4" />
        <div className="flex flex-wrap gap-8 items-center w-5/6">
          <DropdownSelect type={DropdownSelectType.MultiString} title="Threads" items={threads} initialSelected={selectedThreads} onChangeSelected={(items) => setSelectedThreads(items as string[])} />
          <DropdownSelect type={DropdownSelectType.MultiString} title="Event types" items={eventTypes} initialSelected={selectedEventTypes} onChangeSelected={(items) => setSelectedEventTypes(items as string[])} />
        </div>
        <div className="py-8" />
        {events.filter((e) => selectedThreads.includes(e.thread) && selectedEventTypes.includes(e.eventType)).map((e, index) => (
          <div key={index} className={"ml-16 w-3/5"}>
            {index > 0 && <div className='py-2' />}
            {index > 0 &&
              <SessionReplayEventVerticalConnector milliseconds={DateTime.fromISO(e.timestamp, { zone: 'utc' }).toMillis() - DateTime.fromISO(events[index - 1].timestamp, { zone: 'utc' }).toMillis()} />
            }
            {index > 0 && <div className='py-2' />}
            <SessionReplayEventAccordion teamId={teamId} appId={appId} eventType={e.eventType} eventDetails={e.details} timestamp={e.timestamp} threadName={e.thread} id={`${e.eventType}-${index}`} active={false} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default SessionReplay