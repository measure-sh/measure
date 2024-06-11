"use client"

import React, { useEffect, useState } from 'react';
import { ResponsiveLine } from '@nivo/line'
import { AppVersion, CrashOrAnrType, ExceptionsOverviewPlotApiStatus, emptyExceptionsOverviewPlotResponse, fetchExceptionsOverviewPlotFromServer } from '../api/api_calls';
import { useRouter } from 'next/navigation';
import { formatDateToHumanReadable } from '../utils/time_utils';

interface ExceptionsOverviewPlotProps {
  appId: string,
  crashOrAnrType: CrashOrAnrType,
  startDate: string,
  endDate: string,
  appVersions: AppVersion[]
}

const ExceptionsOverviewPlot: React.FC<ExceptionsOverviewPlotProps> = ({ appId, crashOrAnrType, startDate, endDate, appVersions }) => {
  const router = useRouter()

  const [exceptionsOverviewPlotApiStatus, setExceptionsOverviewPlotApiStatus] = useState(ExceptionsOverviewPlotApiStatus.Loading);
  const [plot, setPlot] = useState(emptyExceptionsOverviewPlotResponse);
  const [pointIdToInstanceMap, setPointIdToInstanceMap] = useState(new Map<String, number>())

  const getExceptionsOverviewPlot = async () => {
    // Don't try to fetch plot if app id is not yet set
    if (appId === "") {
      return
    }

    setExceptionsOverviewPlotApiStatus(ExceptionsOverviewPlotApiStatus.Loading)

    const result = await fetchExceptionsOverviewPlotFromServer(appId, crashOrAnrType, startDate, endDate, appVersions, router)

    switch (result.status) {
      case ExceptionsOverviewPlotApiStatus.Error:
        setExceptionsOverviewPlotApiStatus(ExceptionsOverviewPlotApiStatus.Error)
        break
      case ExceptionsOverviewPlotApiStatus.NoData:
        setExceptionsOverviewPlotApiStatus(ExceptionsOverviewPlotApiStatus.NoData)
        break
      case ExceptionsOverviewPlotApiStatus.Success:
        setExceptionsOverviewPlotApiStatus(ExceptionsOverviewPlotApiStatus.Success)

        // map result data to chart format
        let newPlot = result.data.map((item: any) => ({
          id: item.id,
          data: item.data.map((data: any, index: number) => ({
            id: item.id + '.' + index,
            x: data.datetime,
            y: crashOrAnrType === CrashOrAnrType.Crash ? data.crash_free_sessions : data.anr_free_sessions,
            instances: data.instances
          }))
        }))

        // create map of point id to instance count for use in custom tooltip
        let newPointIdToInstanceMap = new Map<String, number>()
        newPlot.forEach((item: any) => {
          item.data.forEach((subItem: any) => {
            console.log(subItem.id + '  : ' + subItem.instances)
            newPointIdToInstanceMap.set(subItem.id, subItem.instances)
          })
        })

        setPlot(newPlot)
        setPointIdToInstanceMap(newPointIdToInstanceMap)
        break
    }
  }

  useEffect(() => {
    getExceptionsOverviewPlot()
  }, [appId, crashOrAnrType, startDate, endDate, appVersions]);

  return (
    <div className="flex border border-black font-sans items-center justify-center w-full h-[36rem]">
      {exceptionsOverviewPlotApiStatus === ExceptionsOverviewPlotApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {exceptionsOverviewPlotApiStatus === ExceptionsOverviewPlotApiStatus.NoData && <p className="text-lg font-display text-center p-4">No Data</p>}
      {exceptionsOverviewPlotApiStatus === ExceptionsOverviewPlotApiStatus.Success &&
        <ResponsiveLine
          data={plot}
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
            legend: crashOrAnrType === CrashOrAnrType.Crash ? '% Crash free sessions ' : '% ANR free sessions',
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
                <p>{crashOrAnrType === CrashOrAnrType.Crash ? 'Crash' : 'ANR'} free sessions: {point.data.yFormatted}%</p>
                <p>No of {crashOrAnrType === CrashOrAnrType.Crash ? 'Crashes' : 'ANRs'}: {pointIdToInstanceMap.get(point.id)}</p>
              </div>
            )
          }}
        />}
    </div>
  )

};

export default ExceptionsOverviewPlot;