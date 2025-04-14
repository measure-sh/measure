"use client"

import React, { useEffect, useState } from 'react'
import { ResponsiveLine } from '@nivo/line'
import { ExceptionsType, ExceptionsOverviewPlotApiStatus, fetchExceptionsOverviewPlotFromServer } from '../api/api_calls'
import { formatDateToHumanReadableDate } from '../utils/time_utils'
import { Filters } from './filters'
import LoadingSpinner from './loading_spinner'

interface ExceptionsOverviewPlotProps {
  exceptionsType: ExceptionsType,
  filters: Filters
}

type ExceptionsOverviewPlot = {
  id: string
  data: {
    id: string
    x: string
    y: number
    instances: number
  }[]
}[]

const ExceptionsOverviewPlot: React.FC<ExceptionsOverviewPlotProps> = ({ exceptionsType, filters }) => {
  const [exceptionsOverviewPlotApiStatus, setExceptionsOverviewPlotApiStatus] = useState(ExceptionsOverviewPlotApiStatus.Loading)
  const [plot, setPlot] = useState<ExceptionsOverviewPlot>()
  const [pointIdToInstanceMap, setPointIdToInstanceMap] = useState(new Map<String, number>())

  const getExceptionsOverviewPlot = async () => {
    // Don't try to fetch plot if filters aren't ready
    if (!filters.ready) {
      return
    }

    setExceptionsOverviewPlotApiStatus(ExceptionsOverviewPlotApiStatus.Loading)

    const result = await fetchExceptionsOverviewPlotFromServer(exceptionsType, filters)

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
            y: exceptionsType === ExceptionsType.Crash ? data.crash_free_sessions : data.anr_free_sessions,
            instances: data.instances
          }))
        }))

        // create map of point id to instance count for use in custom tooltip
        let newPointIdToInstanceMap = new Map<String, number>()
        newPlot.forEach((item: any) => {
          item.data.forEach((subItem: any) => {
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
  }, [exceptionsType, filters])

  return (
    <div className="flex border border-black font-body items-center justify-center w-full h-[36rem]">
      {exceptionsOverviewPlotApiStatus === ExceptionsOverviewPlotApiStatus.Loading && <LoadingSpinner />}
      {exceptionsOverviewPlotApiStatus === ExceptionsOverviewPlotApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {exceptionsOverviewPlotApiStatus === ExceptionsOverviewPlotApiStatus.NoData && <p className="text-lg font-display text-center p-4">No Data</p>}
      {exceptionsOverviewPlotApiStatus === ExceptionsOverviewPlotApiStatus.Success &&
        <ResponsiveLine
          data={plot!}
          curve="monotoneX"
          colors={{ scheme: 'nivo' }}
          margin={{ top: 40, right: 120, bottom: 120, left: 120 }}
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
            format: value => Number.isInteger(value) ? value : '',
            legend: exceptionsType === ExceptionsType.Crash ? '% Crash free sessions ' : '% ANR free sessions',
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
          enableSlices="x"
          sliceTooltip={({ slice }) => {
            return (
              <div className="bg-neutral-950 text-white flex flex-col p-2 text-xs">
                <p className='p-2'>Date: {formatDateToHumanReadableDate(slice.points[0].data.xFormatted.toString())}</p>
                {slice.points.map((point) => (
                  <div className="flex flex-row items-center p-2" key={point.id}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                    <div className="px-2" />
                    <p>{point.serieId.toString()} - </p>
                    <div className="px-2" />
                    <p>{point.data.yFormatted}% {exceptionsType === ExceptionsType.Crash ? 'Crash' : 'ANR'} free sessions, {pointIdToInstanceMap.get(point.id)} {exceptionsType === ExceptionsType.Crash ? (pointIdToInstanceMap.get(point.id)! > 1 ? 'Crashes' : 'Crash') : (pointIdToInstanceMap.get(point.id)! > 1 ? 'ANRs' : 'ANR')} </p>
                  </div>
                ))}
              </div>
            )
          }}
        />}
    </div>
  )

}

export default ExceptionsOverviewPlot