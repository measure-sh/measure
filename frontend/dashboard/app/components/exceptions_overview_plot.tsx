"use client"

import { ResponsiveLine } from '@nivo/line'
import { useTheme } from 'next-themes'
import React, { useEffect, useState } from 'react'
import { ExceptionsOverviewPlotApiStatus, ExceptionsType, fetchExceptionsOverviewPlotFromServer } from '../api/api_calls'
import { chartTheme } from '../utils/shared_styles'
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
  }[]
}[]

const ExceptionsOverviewPlot: React.FC<ExceptionsOverviewPlotProps> = ({ exceptionsType, filters }) => {
  const [exceptionsOverviewPlotApiStatus, setExceptionsOverviewPlotApiStatus] = useState(ExceptionsOverviewPlotApiStatus.Loading)
  const [plot, setPlot] = useState<ExceptionsOverviewPlot>()
  const { theme } = useTheme()

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
            y: data.instances
          }))
        }))

        setPlot(newPlot)
        break
    }
  }

  useEffect(() => {
    getExceptionsOverviewPlot()
  }, [exceptionsType, filters])

  return (
    <div className="flex font-body items-center justify-center w-full h-[36rem]">
      {exceptionsOverviewPlotApiStatus === ExceptionsOverviewPlotApiStatus.Loading && <LoadingSpinner />}
      {exceptionsOverviewPlotApiStatus === ExceptionsOverviewPlotApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {exceptionsOverviewPlotApiStatus === ExceptionsOverviewPlotApiStatus.NoData && <p className="text-lg font-display text-center p-4">No Data</p>}
      {exceptionsOverviewPlotApiStatus === ExceptionsOverviewPlotApiStatus.Success &&
        <ResponsiveLine
          data={plot!}
          curve="monotoneX"
          theme={chartTheme}
          enableArea={true}
          areaOpacity={0.1}
          colors={{ scheme: theme === 'dark' ? 'dark2' : 'nivo' }}
          margin={{ top: 40, right: 40, bottom: 140, left: 100 }}
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
            legend: exceptionsType === ExceptionsType.Crash ? 'Crash instances' : 'ANR instances',
            legendOffset: -80,
            legendPosition: 'middle'
          }}
          pointSize={6}
          pointBorderWidth={1.5}
          pointColor={theme === 'dark' ? "rgba(0, 0, 0, 255)" : "rgba(255, 255, 255, 255)"}
          pointBorderColor={{
            from: 'serieColor',
            modifiers: [
              [
                'darker',
                0.3
              ]
            ]
          }}
          pointLabelYOffset={-12}
          useMesh={true}
          enableGridX={false}
          enableGridY={false}
          enableSlices="x"
          sliceTooltip={({ slice }) => {
            return (
              <div className="bg-accent text-accent-foreground flex flex-col p-2 text-xs rounded-md">
                <p className='p-2'>Date: {formatDateToHumanReadableDate(slice.points[0].data.xFormatted.toString())}</p>
                {slice.points.map((point) => (
                  <div className="flex flex-row items-center p-2" key={point.id}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                    <div className="px-2" />
                    <p>{point.serieId.toString()} - </p>
                    <div className="px-2" />
                    <p>{point.data.y.toString()} {point.data.y.valueOf() as number > 1 ? 'instances' : 'instance'}</p>
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
