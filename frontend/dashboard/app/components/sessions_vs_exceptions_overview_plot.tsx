"use client"

import { ResponsiveLine } from '@nivo/line'
import { DateTime } from 'luxon'
import { useTheme } from 'next-themes'
import React, { useEffect, useState } from 'react'
import { SessionsVsExceptionsPlotApiStatus, fetchSessionsVsExceptionsPlotFromServer } from '../api/api_calls'
import { numberToKMB } from '../utils/number_utils'
import { chartTheme } from '../utils/shared_styles'
import { formatDateToHumanReadableDate } from '../utils/time_utils'
import { Filters } from './filters'
import LoadingSpinner from './loading_spinner'

const demoDataDate = DateTime.now()
const demoPlot = [
  {
    id: 'Sessions',
    data: [
      { id: 's.1', x: demoDataDate.toFormat('yyyy-MM-dd'), y: 1720000 },
      { id: 's.2', x: demoDataDate.minus({ days: 1 }).toFormat('yyyy-MM-dd'), y: 1610000 },
      { id: 's.3', x: demoDataDate.minus({ days: 2 }).toFormat('yyyy-MM-dd'), y: 1580000 },
      { id: 's.4', x: demoDataDate.minus({ days: 3 }).toFormat('yyyy-MM-dd'), y: 1420000 },
      { id: 's.5', x: demoDataDate.minus({ days: 4 }).toFormat('yyyy-MM-dd'), y: 1350000 },
      { id: 's.6', x: demoDataDate.minus({ days: 5 }).toFormat('yyyy-MM-dd'), y: 1240000 },
      { id: 's.7', x: demoDataDate.minus({ days: 6 }).toFormat('yyyy-MM-dd'), y: 1080000 },
    ]
  },
  {
    id: 'Crashes',
    data: [
      { id: 'c.1', x: demoDataDate.toFormat('yyyy-MM-dd'), y: 15400 },
      { id: 'c.2', x: demoDataDate.minus({ days: 1 }).toFormat('yyyy-MM-dd'), y: 14600 },
      { id: 'c.3', x: demoDataDate.minus({ days: 2 }).toFormat('yyyy-MM-dd'), y: 14300 },
      { id: 'c.4', x: demoDataDate.minus({ days: 3 }).toFormat('yyyy-MM-dd'), y: 12800 },
      { id: 'c.5', x: demoDataDate.minus({ days: 4 }).toFormat('yyyy-MM-dd'), y: 12100 },
      { id: 'c.6', x: demoDataDate.minus({ days: 5 }).toFormat('yyyy-MM-dd'), y: 11100 },
      { id: 'c.7', x: demoDataDate.minus({ days: 6 }).toFormat('yyyy-MM-dd'), y: 9700 },
    ]
  },
  {
    id: 'ANRs',
    data: [
      { id: 'a.1', x: demoDataDate.toFormat('yyyy-MM-dd'), y: 5200 },
      { id: 'a.2', x: demoDataDate.minus({ days: 1 }).toFormat('yyyy-MM-dd'), y: 4800 },
      { id: 'a.3', x: demoDataDate.minus({ days: 2 }).toFormat('yyyy-MM-dd'), y: 4700 },
      { id: 'a.4', x: demoDataDate.minus({ days: 3 }).toFormat('yyyy-MM-dd'), y: 4300 },
      { id: 'a.5', x: demoDataDate.minus({ days: 4 }).toFormat('yyyy-MM-dd'), y: 4100 },
      { id: 'a.6', x: demoDataDate.minus({ days: 5 }).toFormat('yyyy-MM-dd'), y: 3700 },
      { id: 'a.7', x: demoDataDate.minus({ days: 6 }).toFormat('yyyy-MM-dd'), y: 3200 },
    ]
  }
]

interface SessionsVsExceptionsPlotProps {
  filters: Filters
  demo?: boolean
}

type SessionsVsExceptionsPlot = {
  id: string
  data: {
    id: string
    x: string
    y: number
  }[]
}[]

const SessionsVsExceptionsPlot: React.FC<SessionsVsExceptionsPlotProps> = ({ filters, demo = false }) => {
  const [sessionsVsExceptionsPlotApiStatus, setSessionsVsExceptionsPlotApiStatus] = useState(SessionsVsExceptionsPlotApiStatus.Loading)
  const [plot, setPlot] = useState<SessionsVsExceptionsPlot>()
  const { theme } = useTheme()

  const colorMap = theme === 'dark' ? {
    Sessions: 'oklch(0.6042 0.1238 244.6)',
    Crashes: 'oklch(0.6014 0.199 26.6)',
    ANRs: 'oklch(0.6664 0.1851 51.88)'
  } : {
    Sessions: 'oklch(90.1% 0.058 230.902)',
    Crashes: 'oklch(80.8% 0.114 19.571)',
    ANRs: 'oklch(89.2% 0.058 10.001)'
  } as const;

  const labelMap = {
    Sessions: 'Sessions',
    Crashes: 'Crashes',
    ANRs: 'ANRs'
  } as const;

  const getSessionsVsExceptionsPlot = async () => {
    if (demo) {
      setSessionsVsExceptionsPlotApiStatus(SessionsVsExceptionsPlotApiStatus.Success)
      setPlot(demoPlot)
      return
    }

    // Don't try to fetch plot if filters aren't ready
    if (!filters.ready) {
      return
    }

    setSessionsVsExceptionsPlotApiStatus(SessionsVsExceptionsPlotApiStatus.Loading)

    const result = await fetchSessionsVsExceptionsPlotFromServer(filters)

    switch (result.status) {
      case SessionsVsExceptionsPlotApiStatus.Error:
        setSessionsVsExceptionsPlotApiStatus(SessionsVsExceptionsPlotApiStatus.Error)
        break
      case SessionsVsExceptionsPlotApiStatus.NoData:
        setSessionsVsExceptionsPlotApiStatus(SessionsVsExceptionsPlotApiStatus.NoData)
        setPlot(undefined)
        break
      case SessionsVsExceptionsPlotApiStatus.Success:
        setSessionsVsExceptionsPlotApiStatus(SessionsVsExceptionsPlotApiStatus.Success)
        setPlot(result.data ?? undefined)
        break
    }
  }

  useEffect(() => {
    getSessionsVsExceptionsPlot()
  }, [filters])

  return (
    <div className="flex font-body items-center justify-center w-full h-[24rem]">
      {sessionsVsExceptionsPlotApiStatus === SessionsVsExceptionsPlotApiStatus.Loading && <LoadingSpinner />}
      {sessionsVsExceptionsPlotApiStatus === SessionsVsExceptionsPlotApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {sessionsVsExceptionsPlotApiStatus === SessionsVsExceptionsPlotApiStatus.NoData && <p className="text-lg font-display text-center p-4">No Data</p>}
      {sessionsVsExceptionsPlotApiStatus === SessionsVsExceptionsPlotApiStatus.Success &&
        <ResponsiveLine
          data={plot!}
          curve="monotoneX"
          theme={chartTheme}
          enableArea={true}
          areaOpacity={0.1}
          colors={({ id }) => colorMap[id as keyof typeof colorMap] || '#888'}
          margin={{ top: 40, right: 40, bottom: 80, left: 40 }}
          xFormat="time:%Y-%m-%d"
          xScale={{
            format: '%Y-%m-%d',
            precision: 'day',
            type: 'time',
            useUTC: false
          }}
          yScale={{
            type: 'linear',
            min: 0,
            max: 'auto'
          }}
          yFormat="d"
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickPadding: 16,
            format: '%b %d, %Y',
            legendPosition: 'middle',
            tickRotation: 55
          }}
          axisLeft={{
            tickSize: 1,
            tickPadding: 5,
            format: value => Number.isInteger(value) ? numberToKMB(value) : '',
          }}
          pointSize={6}
          pointBorderWidth={1.5}
          pointColor={theme === 'dark' ? "rgba(0, 0, 0, 255)" : "rgba(255, 255, 255, 255)"}
          pointBorderColor={({ serieId }: { serieId: string }) => colorMap[serieId as keyof typeof colorMap] || '#888'}
          pointLabelYOffset={-12}
          useMesh={true}
          enableGridX={false}
          enableGridY={false}
          enableSlices="x"
          sliceTooltip={({ slice }) => {
            const order = ['Sessions', 'Crashes', 'ANRs'] as const;
            const pointsById: Record<string, typeof slice.points[number]> = Object.fromEntries(slice.points.map(p => [p.serieId, p]));
            return (
              <div className="bg-accent text-accent-foreground flex flex-col p-2 text-xs rounded-md">
                <p className='p-2'>Date: {formatDateToHumanReadableDate(slice.points[0].data.xFormatted.toString())}</p>
                {order.map((key) => {
                  const point = pointsById[key];
                  if (!point) return null;
                  return (
                    <div className="flex flex-row items-center p-2" key={point.id}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colorMap[key] }} />
                      <div className="px-2" />
                      <p>{labelMap[key]} - </p>
                      <div className="px-2" />
                      <p>{point.data.yFormatted} {labelMap[key]}</p>
                    </div>
                  );
                })}
              </div>
            );
          }}
        />}
    </div>
  )

}

export default SessionsVsExceptionsPlot