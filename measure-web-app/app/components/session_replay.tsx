"use client"

import React, { useEffect, useState } from 'react';
import { ResponsiveLine } from '@nivo/line'
import { emptySessionReplay } from '../api/api_calls';
import SessionReplayEventAccordion from './session_replay_event_accordion';
import SessionReplayEventVerticalConnector from './session_replay_event_vertical_connector';
import FadeInOut from './fade_in_out';
import CheckboxDropdown from './checkbox_dropdown';
import { formatTimestampToChartFormat } from '../utils/time_utils';

interface SessionReplayProps {
  sessionReplay: typeof emptySessionReplay
}

const SessionReplay: React.FC<SessionReplayProps> = ({ sessionReplay }) => {

  const cpuData = [
    {
      id: '% CPU Usage',
      data: sessionReplay.cpu_usage.map(item => ({
        x: formatTimestampToChartFormat(item.timestamp),
        y: item.value
      }))
    }
  ]

  const memoryData = [
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
  ]

  const { events, threads, eventTypes } = parseEventsThreadsAndEventTypesFromSessionReplay()

  function parseEventsThreadsAndEventTypesFromSessionReplay() {
    let events: { eventType: string; timestamp: string; thread: string; details: any; }[] = []
    let threads = new Set<string>()
    let eventTypes = new Set<string>()

    Object.keys(sessionReplay.threads).forEach(item => (
      // @ts-ignore
      sessionReplay.threads[item].forEach((subItem: any) => {
        events.push({
          eventType: subItem.event_type,
          timestamp: formatTimestampToChartFormat(subItem.timestamp),
          thread: item,
          details: subItem
        })
        threads.add(item)
        eventTypes.add(subItem.event_type)
      })
    ))

    events.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateA.getMilliseconds() - dateB.getMilliseconds();
    });

    let threadsArray = Array.from(threads)
    let eventsTypesArray = Array.from(eventTypes)

    return { events, threads: threadsArray, eventTypes: eventsTypesArray }
  }

  const [selectedThreads, setSelectedThreads] = useState(threads);
  const [selectedEventTypes, setSelectedEventTypes] = useState(eventTypes);

  // Hack for initial animation on cpu and memory charts. We set initial data
  // such that all y values are 0. Then we implement a timer that sets the real
  // data after a delay. This is needed because there is no current way to 
  // animate lines in directly on render in nivo charts
  const [cpuChartData, setCpuChartData] = useState(cpuData.map(d => ({
    id: d.id,
    data: d.data.map(p => ({
      x: p.x,
      y: 0
    }))
  })));
  const [memoryChartData, setMemoryChartData] = useState(memoryData.map(d => ({
    id: d.id,
    data: d.data.map(p => ({
      x: p.x,
      y: 0
    }))
  })));
  useEffect(() => {
    let animation = setTimeout(() => {
      setCpuChartData(cpuData);
      setMemoryChartData(memoryData)
    }, 200);
    return () => clearTimeout(animation)
  }, [cpuData]);

  return (
    <div className="flex flex-col w-screen font-sans text-black">
      {/* Memory line */}
      <div className="h-96">
        <ResponsiveLine
          animate
          data={memoryChartData}
          curve="monotoneX"
          crosshairType="cross"
          margin={{ top: 40, right: 160, bottom: 80, left: 90 }}
          xFormat='time:%Y-%m-%d %H:%M:%S:%L %p'
          xScale={{
            format: '%Y-%m-%d %I:%M:%S:%L %p',
            precision: 'millisecond',
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
          yFormat=" >-.2f"
          axisTop={null}
          axisRight={null}
          axisBottom={{
            format: '%I:%M:%S %p',
            legendPosition: 'middle'
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

        />
      </div>
      {/* CPU line */}
      <div className="h-56">
        <ResponsiveLine
          animate
          data={cpuChartData}
          curve="monotoneX"
          crosshairType="cross"
          margin={{ top: 40, right: 160, bottom: 80, left: 90 }}
          xFormat='time:%Y-%m-%d %I:%M:%S:%L %p'
          xScale={{
            format: '%Y-%m-%d %I:%M:%S:%L %p',
            precision: 'millisecond',
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
          yFormat=" >-.2f"
          axisTop={null}
          axisRight={null}
          axisBottom={{
            format: '%I:%M:%S %p',
            legendPosition: 'middle'
          }}
          axisLeft={{
            tickSize: 1,
            tickPadding: 5,
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
                  opacity: 0
                }
              ],
              id: 'cpuGradient',
              type: 'linearGradient'
            }
          ]}
          enableArea
          enableCrosshair
          enableSlices="x"
          fill={[
            {
              id: 'cpuGradient',
              match: '*'
            }
          ]}
        />
      </div>
      {/* Events*/}
      <div>
        <div className="py-4" />
        <p className="font-sans text-3xl"> Events</p>
        <div className="py-4" />
        <div className="flex flex-wrap gap-8 items-center w-5/6">
          <CheckboxDropdown title="Threads" items={threads} initialSelectedItems={threads} onChangeSelectedItems={(items) => setSelectedThreads(items)} />
          <CheckboxDropdown title="Event types" items={eventTypes} initialSelectedItems={eventTypes} onChangeSelectedItems={(items) => setSelectedEventTypes(items)} />
        </div>
        <div className="py-8" />
        {events.filter((e) => selectedThreads.includes(e.thread) && selectedEventTypes.includes(e.eventType)).map((e, index) => (
          <div key={index} className={"ml-16 w-3/5"}>
            {index > 0 && <div className='py-2' />}
            {index > 0 &&
              <FadeInOut>
                <SessionReplayEventVerticalConnector milliseconds={new Date(e.timestamp).getMilliseconds() - new Date(events[index - 1].timestamp).getMilliseconds()} />
              </FadeInOut>
            }
            {index > 0 && <div className='py-2' />}
            <FadeInOut>
              <SessionReplayEventAccordion eventType={e.eventType} eventDetails={e.details} timestamp={e.timestamp} threadName={e.thread} id={`${e.eventType}-${index}`} active={false} />
            </FadeInOut>
          </div>
        ))}
      </div>
    </div>
  )
};

export default SessionReplay;