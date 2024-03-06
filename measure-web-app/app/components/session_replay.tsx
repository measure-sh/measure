"use client"

import React from 'react';
import { ResponsiveLine } from '@nivo/line'
import { emptySessionReplay } from '../api/api_calls';
import SessionReplayEventAccordion from './session_replay_event_accordion';

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
      "id": "% CPU Usage",
      "color": "hsl(142, 69%, 58%)",
      "data": sessionReplay.cpu_usage.map(item => ({
        "x": convertTimestampToChartFormat(item.timestamp),
        "y": item.value
      }))
    }
  ]

  const memoryData = [
    {
      "id": "Memory",
      "color": "hsl(198, 93%, 60%)",
      "data": sessionReplay.memory_usage.map(item => ({
        "x": convertTimestampToChartFormat(item.timestamp),
        "y": item.java_free_heap
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
      <div className="h-56">
        <ResponsiveLine
          data={memoryData}
          curve="monotoneX"
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
            min: 'auto',
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
          pointLabelYOffset={-12}
          useMesh={true}
          colors={memoryData.map((i) => i.color)}
          defs={[
            {
              colors: [
                {
                  color: memoryData.map((i) => i.color),
                  offset: 0
                },
                {
                  color: memoryData.map((i) => i.color),
                  offset: 60,
                  opacity: 0
                }
              ],
              id: 'memoryGradient',
              type: 'linearGradient'
            }
          ]}
          enableArea
          fill={[
            {
              id: 'memoryGradient',
              match: '*'
            }
          ]}
          tooltip={({
            point
          }) => <div className="pointer-events-none z-50 rounded-md p-4 bg-neutral-800">
              <p className="font-sans text-white">{point.data.yFormatted} MB</p>
            </div>}

        />
      </div>
      {/* CPU line */}
      <div className="h-56">
        <ResponsiveLine
          data={cpuData}
          curve="monotoneX"
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
            min: 'auto',
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
          pointLabelYOffset={-12}
          useMesh={true}
          colors={cpuData.map((i) => i.color)}
          defs={[
            {
              colors: [
                {
                  color: cpuData.map((i) => i.color),
                  offset: 0
                },
                {
                  color: cpuData.map((i) => i.color),
                  offset: 60,
                  opacity: 0
                }
              ],
              id: 'cpuGradient',
              type: 'linearGradient'
            }
          ]}
          enableArea
          fill={[
            {
              id: 'cpuGradient',
              match: '*'
            }
          ]}
          tooltip={({
            point
          }) => <div className="pointer-events-none z-50 rounded-md p-4 bg-neutral-800">
              <p className="font-sans text-white">{point.data.yFormatted}%</p>
            </div>}
        />
      </div>
      {/* Events*/}
      <div>
        <div className="py-4" />
        <p className="font-sans text-3xl"> Events</p>
        <div className="py-2" />
        {events.map((e, index) => (
          <div key={index} className={"mt-8 mb-8 w-3/5"}>
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