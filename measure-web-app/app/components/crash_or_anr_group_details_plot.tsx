"use client"

import React, { useEffect, useState } from 'react';
import { ResponsiveLine } from '@nivo/line'
import { AppVersion, CrashOrAnrGroupDetailsPlotApiStatus, CrashOrAnrType, fetchCrashOrAnrGroupDetailsPlotFromServer } from '../api/api_calls';
import { useRouter } from 'next/navigation';
import { formatDateToHumanReadable } from '../utils/time_utils';

interface CrashOrAnrGroupDetailsPlotProps {
  appId: string,
  crashOrAnrType: CrashOrAnrType,
  crashOrAnrGroupId: string,
  startDate: string,
  endDate: string,
  appVersions: AppVersion[],
  countries: string[],
  networkProviders: string[],
  networkTypes: string[],
  networkGenerations: string[],
  locales: string[],
  deviceManufacturers: string[],
  deviceNames: string[]
}

type ExceptionsDetailsPlot = {
  id: string
  data: {
    x: string
    y: number
  }[]
}[]

const CrashOrAnrGroupDetailsPlot: React.FC<CrashOrAnrGroupDetailsPlotProps> = ({ appId, crashOrAnrType, crashOrAnrGroupId, startDate, endDate, appVersions, countries, networkProviders, networkTypes, networkGenerations, locales, deviceManufacturers, deviceNames }) => {
  const router = useRouter()

  const [crashOrAnrGroupDetailsPlotApiStatus, setCrashOrAnrGroupDetailsPlotApiStatus] = useState(CrashOrAnrGroupDetailsPlotApiStatus.Loading);
  const [plot, setPlot] = useState<ExceptionsDetailsPlot>();

  const getCrashOrAnrGroupDetailsPlot = async () => {
    // Don't try to fetch plot if app id is not yet set
    if (appId === "") {
      return
    }

    setCrashOrAnrGroupDetailsPlotApiStatus(CrashOrAnrGroupDetailsPlotApiStatus.Loading)

    const result = await fetchCrashOrAnrGroupDetailsPlotFromServer(appId, crashOrAnrType, crashOrAnrGroupId, startDate, endDate, appVersions, countries, networkProviders, networkTypes, networkGenerations, locales, deviceManufacturers, deviceNames, router)

    switch (result.status) {
      case CrashOrAnrGroupDetailsPlotApiStatus.Error:
        setCrashOrAnrGroupDetailsPlotApiStatus(CrashOrAnrGroupDetailsPlotApiStatus.Error)
        break
      case CrashOrAnrGroupDetailsPlotApiStatus.NoData:
        setCrashOrAnrGroupDetailsPlotApiStatus(CrashOrAnrGroupDetailsPlotApiStatus.NoData)
        break
      case CrashOrAnrGroupDetailsPlotApiStatus.Success:
        setCrashOrAnrGroupDetailsPlotApiStatus(CrashOrAnrGroupDetailsPlotApiStatus.Success)

        // map result data to chart format
        setPlot(result.data.map((item: any) => ({
          id: item.id,
          data: item.data.map((data: any) => ({
            x: data.datetime,
            y: data.instances,
          })),
        })))
        break
    }
  }

  useEffect(() => {
    getCrashOrAnrGroupDetailsPlot()
  }, [appId, crashOrAnrType, crashOrAnrGroupId, startDate, endDate, appVersions, countries, networkProviders, networkTypes, networkGenerations, locales, deviceManufacturers, deviceNames]);

  return (
    <div className="flex border border-black font-sans items-center justify-center w-full h-[32rem]">
      {crashOrAnrGroupDetailsPlotApiStatus === CrashOrAnrGroupDetailsPlotApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {crashOrAnrGroupDetailsPlotApiStatus === CrashOrAnrGroupDetailsPlotApiStatus.NoData && <p className="text-lg font-display text-center p-4">No Data</p>}
      {crashOrAnrGroupDetailsPlotApiStatus === CrashOrAnrGroupDetailsPlotApiStatus.Success &&
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
          yFormat=" >-.2f"
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
            legend: crashOrAnrType === CrashOrAnrType.Crash ? 'Crash instances' : 'ANR instances',
            legendOffset: -80,
            legendPosition: 'middle'
          }}
          pointSize={10}
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
          tooltip={({ point }) => {
            return (
              <div className='bg-neutral-950 text-white flex flex-col p-2 text-xs'>
                <p>Date: {formatDateToHumanReadable(point.data.xFormatted.toString())}</p>
                <p>No of {crashOrAnrType === CrashOrAnrType.Crash ? 'Crashes' : 'ANRs'}: {point.data.y.toString()}</p>
              </div>
            )
          }}
        />}
    </div>
  )

};

export default CrashOrAnrGroupDetailsPlot;