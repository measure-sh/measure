"use client"

import React from 'react';
import { ResponsiveLine } from '@nivo/line'
import { emptySessionReplay } from '../api/api_calls';
import SessionReplayEventAccordion from './session_replay_event_accordion';
import SessionReplayEventVerticalConnector from './session_replay_event_vertical_connector';

interface SessionReplayProps {
  sessionReplay: typeof emptySessionReplay
}

const SessionReplay: React.FC<SessionReplayProps> = ({ sessionReplay }) => {

  function convertTimestampToChartFormat(timestamp: string) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // Months are 0-based
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const miliseconds = date.getMilliseconds();

    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${miliseconds.toString().padStart(2, '0')}`;
  }

  const cpuData = [
    {
      id: '% CPU Usage',
      data: sessionReplay.cpu_usage.map(item => ({
        x: convertTimestampToChartFormat(item.timestamp),
        y: item.value
      }))
    }
  ]

  const memoryData = [
    {
      id: 'Java Free Heap',
      data: sessionReplay.memory_usage.map(item => ({
        x: convertTimestampToChartFormat(item.timestamp),
        y: item.java_free_heap
      }))
    },
    {
      id: 'Java Max Heap',
      data: sessionReplay.memory_usage.map(item => ({
        x: convertTimestampToChartFormat(item.timestamp),
        y: item.java_max_heap
      }))
    },
    {
      id: 'Java Total Heap',
      data: sessionReplay.memory_usage.map(item => ({
        x: convertTimestampToChartFormat(item.timestamp),
        y: item.java_total_heap
      }))
    },
    {
      id: 'Native Free Heap',
      data: sessionReplay.memory_usage.map(item => ({
        x: convertTimestampToChartFormat(item.timestamp),
        y: item.native_free_heap
      }))
    },
    {
      id: 'Native Total Heap',
      data: sessionReplay.memory_usage.map(item => ({
        x: convertTimestampToChartFormat(item.timestamp),
        y: item.native_total_heap
      }))
    },
    {
      id: 'RSS',
      data: sessionReplay.memory_usage.map(item => ({
        x: convertTimestampToChartFormat(item.timestamp),
        y: item.rss
      }))
    },
    {
      id: 'Total PSS',
      data: sessionReplay.memory_usage.map(item => ({
        x: convertTimestampToChartFormat(item.timestamp),
        y: item.total_pss
      }))
    }
  ]

  const events = parseEventsFromSessionReplay()

  function parseEventsFromSessionReplay() {
    let events: { eventType: string; timestamp: string; thread: string; description: any; }[] = []

    Object.keys(sessionReplay.threads).forEach(item => (
      // @ts-ignore
      sessionReplay.threads[item].forEach((subItem: any) => (
        events.push({
          eventType: subItem.event_type,
          timestamp: convertTimestampToChartFormat(subItem.timestamp),
          thread: item,
          description: subItem
        })
      ))
    ))

    return events
  }

  return (
    <div className="flex flex-col w-screen font-sans text-black">
      {/* Memory line */}
      <div className="h-96">
        <ResponsiveLine
          data={memoryData}
          curve="monotoneX"
          crosshairType="cross"
          margin={{ top: 40, right: 160, bottom: 80, left: 90 }}
          xFormat="time:%Y-%m-%d %H:%M:%S:%L"
          xScale={{
            format: '%Y-%m-%d %H:%M:%S:%L',
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
            format: '%H:%M:%S:%L',
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
          data={cpuData}
          curve="monotoneX"
          crosshairType="cross"
          margin={{ top: 40, right: 160, bottom: 80, left: 90 }}
          xFormat="time:%Y-%m-%d %H:%M:%S:%L"
          xScale={{
            format: '%Y-%m-%d %H:%M:%S:%L',
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
            format: '%H:%M:%S:%L',
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
        <div className="py-2" />
        {events.map((e, index) => (
          <div key={index} className={"ml-16 w-3/5"}>
            {index > 0 && <div className='py-2' />}
            {index > 0 && <SessionReplayEventVerticalConnector milliseconds={new Date(e.timestamp).getMilliseconds() - new Date(events[index - 1].timestamp).getMilliseconds()} />}
            {index > 0 && <div className='py-2' />}
            <SessionReplayEventAccordion eventType={e.eventType} timestamp={e.timestamp} threadName={e.thread} id={`${e.eventType}-${index}`} active={false}>
              {JSON.stringify(e.description, null, 2)}
            </SessionReplayEventAccordion>
          </div>
        ))}
      </div>
    </div>
  )
};

export default SessionReplay;