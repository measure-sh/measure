"use client"

import { ResponsiveLine } from '@nivo/line'
import React, { useEffect, useState } from 'react'
import { SessionsVsExceptionsPlotApiStatus, fetchSessionsVsExceptionsPlotFromServer } from '../api/api_calls'
import { formatDateToHumanReadableDate } from '../utils/time_utils'
import { Filters } from './filters'
import LoadingSpinner from './loading_spinner'

interface SessionsVsExceptionsPlotProps {
  filters: Filters
}

type SessionsVsExceptionsPlot = {
  id: string
  data: {
    id: string
    x: string
    y: number
  }[]
}[]

const SessionsVsExceptionsPlot: React.FC<SessionsVsExceptionsPlotProps> = ({ filters }) => {
  const [sessionsVsExceptionsPlotApiStatus, setSessionsVsExceptionsPlotApiStatus] = useState(SessionsVsExceptionsPlotApiStatus.Loading)
  const [plot, setPlot] = useState<SessionsVsExceptionsPlot>()

  const colorMap = {
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
            tickPadding: 20,
            format: '%b %d, %Y',
            legendPosition: 'middle'
          }}
          axisLeft={{
            tickSize: 1,
            tickPadding: 5,
            format: value => Number.isInteger(value) ? value : '',
          }}
          pointSize={6}
          pointBorderWidth={1.5}
          pointColor={"rgba(255, 255, 255, 255)"}
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
              <div className="bg-neutral-800 text-white flex flex-col p-2 text-xs rounded-md">
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