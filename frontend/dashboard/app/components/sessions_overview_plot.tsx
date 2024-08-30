"use client"

import React, { useEffect, useState } from 'react';
import { ResponsiveLine } from '@nivo/line'
import { AppVersion, SessionType, SessionsOverviewPlotApiStatus, fetchSessionsOverviewPlotFromServer } from '../api/api_calls';
import { useRouter } from 'next/navigation';
import { formatDateToHumanReadable } from '../utils/time_utils';

interface SessionsOverviewPlotProps {
  appId: string,
  startDate: string,
  endDate: string,
  appVersions: AppVersion[],
  sessionType: SessionType,
  countries: string[],
  networkProviders: string[],
  networkTypes: string[],
  networkGenerations: string[],
  locales: string[],
  deviceManufacturers: string[],
  deviceNames: string[]
  freeText: string
}

type SessionsOverviewPlot = {
  id: string
  data: {
    id: string
    x: string
    y: number
  }[]
}[]

const SessionsOverviewPlot: React.FC<SessionsOverviewPlotProps> = ({ appId, startDate, endDate, appVersions, sessionType, countries, networkProviders, networkTypes, networkGenerations, locales, deviceManufacturers, deviceNames, freeText }) => {
  const router = useRouter()

  const [sessionsOverviewPlotApiStatus, setSessionsOverviewPlotApiStatus] = useState(SessionsOverviewPlotApiStatus.Loading);
  const [plot, setPlot] = useState<SessionsOverviewPlot>();

  const getSessionsOverviewPlot = async () => {
    // Don't try to fetch plot if app id is not yet set
    if (appId === "") {
      return
    }

    setSessionsOverviewPlotApiStatus(SessionsOverviewPlotApiStatus.Loading)

    const result = await fetchSessionsOverviewPlotFromServer(appId, startDate, endDate, appVersions, sessionType, countries, networkProviders, networkTypes, networkGenerations, locales, deviceManufacturers, deviceNames, freeText, router)

    switch (result.status) {
      case SessionsOverviewPlotApiStatus.Error:
        setSessionsOverviewPlotApiStatus(SessionsOverviewPlotApiStatus.Error)
        break
      case SessionsOverviewPlotApiStatus.NoData:
        setSessionsOverviewPlotApiStatus(SessionsOverviewPlotApiStatus.NoData)
        break
      case SessionsOverviewPlotApiStatus.Success:
        setSessionsOverviewPlotApiStatus(SessionsOverviewPlotApiStatus.Success)

        // map result data to chart format
        let newPlot = result.data.map((item: any) => ({
          id: item.id,
          data: item.data.map((data: any, index: number) => ({
            id: item.id + '.' + index,
            x: data.datetime,
            y: data.instances
          }))
        }))

        setPlot(newPlot)
        break
    }
  }

  useEffect(() => {
    getSessionsOverviewPlot()
  }, [appId, startDate, endDate, appVersions, sessionType, countries, networkProviders, networkTypes, networkGenerations, locales, deviceManufacturers, deviceNames, freeText]);

  return (
    <div className="flex border border-black font-sans items-center justify-center w-full h-[36rem]">
      {sessionsOverviewPlotApiStatus === SessionsOverviewPlotApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {sessionsOverviewPlotApiStatus === SessionsOverviewPlotApiStatus.NoData && <p className="text-lg font-display text-center p-4">No Data</p>}
      {sessionsOverviewPlotApiStatus === SessionsOverviewPlotApiStatus.Success &&
        <ResponsiveLine
          data={plot!}
          curve="monotoneX"
          colors={{ scheme: 'nivo' }}
          margin={{ top: 40, right: 160, bottom: 120, left: 120 }}
          xFormat="time:%Y-%m-%d"
          xScale={{
            format: '%Y-%m-%d',
            precision: 'day',
            type: 'time',
            useUTC: false
          }}
          yScale={{
            type: 'linear',
            min: 'auto',
            max: 'auto'
          }}
          yFormat="d"
          axisTop={null}
          axisRight={null}
          axisBottom={{
            legend: 'Date',
            tickPadding: 10,
            legendOffset: 100,
            format: '%b %d, %Y',
            tickRotation: 45,
            legendPosition: 'middle'
          }}
          axisLeft={{
            tickSize: 1,
            tickPadding: 5,
            format: value => Number.isInteger(value) ? value : '',
            legend: 'Sessions',
            legendOffset: -80,
            legendPosition: 'middle'
          }}
          pointSize={3}
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
          pointLabelYOffset={-12}
          useMesh={true}
          legends={[
            {
              anchor: 'bottom-right',
              direction: 'column',
              justify: false,
              translateX: 100,
              translateY: 0,
              itemsSpacing: 0,
              itemDirection: 'left-to-right',
              itemWidth: 80,
              itemHeight: 20,
              itemOpacity: 0.75,
              symbolSize: 12,
              symbolShape: 'circle',
              symbolBorderColor: 'rgba(0, 0, 0, .5)',
            }
          ]}
          enableSlices="x"
          sliceTooltip={({ slice }) => {
            return (
              <div className="bg-neutral-950 text-white flex flex-col p-2 text-xs">
                <p className='p-2'>Date: {formatDateToHumanReadable(slice.points[0].data.xFormatted.toString())}</p>
                {slice.points.map((point) => (
                  <div className="flex flex-row items-center p-2" key={point.id}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                    <div className="px-2" />
                    <p>{point.data.yFormatted} sessions</p>
                  </div>
                ))}
              </div>
            )
          }}
        />}
    </div>
  )

};

export default SessionsOverviewPlot;