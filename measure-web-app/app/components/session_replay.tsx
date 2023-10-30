"use client"

import React from 'react';
import { Point, ResponsiveLine } from '@nivo/line'

const minDate = "2023-10-24 12:01:00"
const maxDate = "2023-10-24 12:08:00"
const date1 = "2023-10-24 12:01:15"
const date2 = "2023-10-24 12:02:30"
const date3 = "2023-10-24 12:03:03"
const date4 = "2023-10-24 12:04:41"
const date5 = "2023-10-24 12:05:21"
const date6 = "2023-10-24 12:06:11"
const date7 = "2023-10-24 12:06:57"
const date8 = "2023-10-24 12:07:39"

const memoryData = [
  {
    "id": "Memory",
    "color": "hsl(198, 93%, 60%)",
    "data": [
      {
        "x": date1,
        "y": 48.6
      },
      {
        "x": date2,
        "y": 52.8
      },
      {
        "x": date3,
        "y": 53.4
      },
      {
        "x": date4,
        "y": 86.2
      },
      {
        "x": date5,
        "y": 86.7
      },
      {
        "x": date6,
        "y": 45.5
      },
      {
        "x": date7,
        "y": 44.8
      },
      {
        "x": date8,
        "y": 44.7
      }
    ]
  }
]

const cpuData = [
  {
    "id": "% CPU Usage",
    "color": "hsl(142, 69%, 58%)",
    "data": [
      {
        "x": date1,
        "y": 15.6
      },
      {
        "x": date2,
        "y": 16.8
      },
      {
        "x": date3,
        "y": 16.4
      },
      {
        "x": date4,
        "y": 45.3
      },
      {
        "x": date5,
        "y": 46.9
      },
      {
        "x": date6,
        "y": 14.5
      },
      {
        "x": date7,
        "y": 15.8
      },
      {
        "x": date8,
        "y": 16.7
      }
    ]
  }
]

const uiThreadData = [
  {
    "id": "UI thread",
    "color": "hsl(0, 0%, 100%)",
    "data": [
      {
        "x": date1,
        "y": 1,
        "color": "hsl(0, 0%, 9%)",
        "event": "Type: Screen Open\nScreen name: HomeActivity.java\nView dimensions: 640x480",
      },
      {
        "x": date2,
        "y": 1,
        "color": "hsl(142, 76%, 36%)",
        "event": "Type: Scroll\nView name: HomeList.java\nView dimensions: 640x320"
      },
      {
        "x": date3,
        "y": 1,
        "color": "hsl(142, 76%, 36%)",
        "event": "Type: Scroll\nView name: HomeList.java\nView dimensions: 640x320"
      },
      {
        "x": date4,
        "y": 1,
        "color": "hsl(142, 76%, 36%)",
        "event": "Type: Scroll\nView name: HomeList.java\nView dimensions: 640x320"
      },
      {
        "x": date5,
        "y": 1,
        "color": "hsl(142, 76%, 36%)",
        "event": "Type: Click\nView name: ItemDetailButton.java\nView dimensions: 464x180"
      },
      {
        "x": date6,
        "y": 1,
        "color": "hsl(0, 0%, 9%)",
        "event": "Type: Screen Open\nScreen name: ItemDetailFragment.java\nView dimensions: 640x480"
      },
      {
        "x": date7,
        "y": 1,
        "color": "hsl(142, 76%, 36%)",
        "event": "Type: Scroll\nView name: ItemDescriptionScrollView.java\nView dimensions: 640x320"
      },
      {
        "x": date8,
        "y": 1,
        "color": "hsl(0, 72%, 51%)",
        "event": "Type: Crash\nView name: NullPointerException.java\n"
      }
    ]
  }
]

const thread1Data = [
  {
    "id": "Thread 1",
    "color": "hsl(0, 0%, 100%)",
    "data": [
      {
        "x": date4,
        "y": 1,
        "color": "hsl(200, 98%, 39%)",
        "event": "Type: Network Request\nURL: /home/list/items/\nHeaders: {x-auth-id: alsdkfjsldfj}"
      },
      {
        "x": date6,
        "y": 1,
        "color": "hsl(200, 98%, 39%)",
        "event": "Type: Network Response\nURL: /home/list/items/\nResponse: {data:[items: [...]]}"
      }
    ]
  }
]

const thread2Data = [
  {
    "id": "Thread 2",
    "color": "hsl(0, 0%, 100%)",
    "data": [
      {
        "x": date3,
        "y": 1,
        "color": "hsl(0, 0%, 9%)",
        "event": "Type: Background job start\nJob name: SyncUserPreferences.java"
      }
    ]
  }
]

const thread3Data = [
  {
    "id": "Thread 3",
    "color": "hsl(0, 0%, 100%)",
    "data": []
  }
]

const thread4Data = [
  {
    "id": "Thread 4",
    "color": "hsl(0, 0%, 100%)",
    "data": []
  }
]

const SessionReplay = () => {
    return (
      <div className="flex flex-col w-screen font-sans text-black">
        {/* Memory line */}
        <div className="h-56">
          <ResponsiveLine
            data={memoryData}
            curve="monotoneX"
            margin={{ top: 40, right: 160, bottom: 80, left: 120 }}
            xFormat="time:%Y-%m-%d %H:%M:%S"
            xScale={{
              format: '%Y-%m-%d %H:%M:%S',
              precision: 'second',
              type: 'time',
              min: minDate,
              max: maxDate,
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
                format: '%H:%M:%S',
                tickValues: 'every 1 minutes',
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
            margin={{ top: 40, right: 160, bottom: 80, left: 120 }}
            xFormat="time:%Y-%m-%d %H:%M:%S"
            xScale={{
              format: '%Y-%m-%d %H:%M:%S',
              precision: 'second',
              type: 'time',
              min: minDate,
              max: maxDate,
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
                format: '%H:%M:%S',
                tickValues: 'every 1 minutes',
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
        {/* UI thread line */}
        <div className="h-56">
          <ResponsiveLine
            data={uiThreadData}
            margin={{ top: 40, right: 160, bottom: 80, left: 120 }}
            xFormat="time:%Y-%m-%d %H:%M:%S"
            xScale={{
              format: '%Y-%m-%d %H:%M:%S',
              precision: 'second',
              type: 'time',
              min: minDate,
              max: maxDate,
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
                format: '%H:%M:%S',
                tickValues: 'every 1 minutes',
                legendPosition: 'middle'
            }}
            axisLeft={{
                tickSize: 1,
                tickPadding: 5,
                legend: 'UI thread',
                legendOffset: -80,
                legendPosition: 'middle'
            }}
            pointSize={1}
            pointBorderWidth={16}
            pointBorderColor={(point: Point) => uiThreadData[0].data[point.index].color}
            pointLabelYOffset={-12}
            useMesh={true}
            enableGridX={true}
            enableGridY={false}
            colors={uiThreadData.map((i) => i.color)}
            tooltip={({
              point
            }) => <div className="pointer-events-none z-50 rounded-md p-4 bg-neutral-800">
                     <p className="font-sans text-white whitespace-pre-wrap">{uiThreadData[0].data[point.index].event} </p>
                  </div>}
          />
        </div>
        {/* Thread 1 line */}
        <div className="h-56">
          <ResponsiveLine
            data={thread1Data}
            margin={{ top: 40, right: 160, bottom: 80, left: 120 }}
            xFormat="time:%Y-%m-%d %H:%M:%S"
            xScale={{
              format: '%Y-%m-%d %H:%M:%S',
              precision: 'second',
              type: 'time',
              min: minDate,
              max: maxDate,
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
                format: '%H:%M:%S',
                tickValues: 'every 1 minutes',
                legendPosition: 'middle'
            }}
            axisLeft={{
                tickSize: 1,
                tickPadding: 5,
                legend: 'Thread 1',
                legendOffset: -80,
                legendPosition: 'middle'
            }}
            pointSize={1}
            pointBorderWidth={16}
            pointBorderColor={(point: Point) => thread1Data[0].data[point.index].color}
            pointLabelYOffset={-12}
            useMesh={true}
            enableGridX={true}
            enableGridY={false}
            colors={thread1Data.map((i) => i.color)}
            tooltip={({
              point
            }) => <div className="pointer-events-none z-50 rounded-md p-4 bg-neutral-800">
                     <p className="font-sans text-white whitespace-pre-wrap">{thread1Data[0].data[point.index].event} </p>
                  </div>}
          />
        </div>
        {/* Thread 2 line */}
        <div className="h-56">
          <ResponsiveLine
            data={thread2Data}
            margin={{ top: 40, right: 160, bottom: 80, left: 120 }}
            xFormat="time:%Y-%m-%d %H:%M:%S"
            xScale={{
              format: '%Y-%m-%d %H:%M:%S',
              precision: 'second',
              type: 'time',
              min: minDate,
              max: maxDate,
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
                format: '%H:%M:%S',
                tickValues: 'every 1 minutes',
                legendPosition: 'middle'
            }}
            axisLeft={{
                tickSize: 1,
                tickPadding: 5,
                legend: 'Thread 2',
                legendOffset: -80,
                legendPosition: 'middle'
            }}
            pointSize={1}
            pointBorderWidth={16}
            pointBorderColor={(point: Point) => thread2Data[0].data[point.index].color}
            pointLabelYOffset={-12}
            useMesh={true}
            enableGridX={true}
            enableGridY={false}
            colors={thread2Data.map((i) => i.color)}
            tooltip={({
              point
            }) => <div className="pointer-events-none z-50 rounded-md p-4 bg-neutral-800">
                     <p className="font-sans text-white whitespace-pre-wrap">{thread2Data[0].data[point.index].event}</p>
                  </div>}
          />
        </div>
        {/* Thread 3 line */}
        <div className="h-56">
          <ResponsiveLine
            data={thread3Data}
            margin={{ top: 40, right: 160, bottom: 80, left: 120 }}
            xFormat="time:%Y-%m-%d %H:%M:%S"
            xScale={{
              format: '%Y-%m-%d %H:%M:%S',
              precision: 'second',
              type: 'time',
              min: minDate,
              max: maxDate,
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
                format: '%H:%M:%S',
                tickValues: 'every 1 minutes',
                legendPosition: 'middle'
            }}
            axisLeft={{
                tickSize: 1,
                tickPadding: 5,
                legend: 'Thread 3',
                legendOffset: -80,
                legendPosition: 'middle'
            }}
            enableGridX={true}
            enableGridY={false}
          />
        </div>
        {/* Thread 4 line */}
        <div className="h-56">
          <ResponsiveLine
            data={thread4Data}
            margin={{ top: 40, right: 160, bottom: 80, left: 120 }}
            xFormat="time:%Y-%m-%d %H:%M:%S"
            xScale={{
              format: '%Y-%m-%d %H:%M:%S',
              precision: 'second',
              type: 'time',
              min: minDate,
              max: maxDate,
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
                format: '%H:%M:%S',
                tickValues: 'every 1 minutes',
                legendPosition: 'middle'
            }}
            axisLeft={{
                tickSize: 1,
                tickPadding: 5,
                legend: 'Thread 4',
                legendOffset: -80,
                legendPosition: 'middle'
            }}
            enableGridX={true}
            enableGridY={false}
          />
        </div>
    </div>
  )};

export default SessionReplay;