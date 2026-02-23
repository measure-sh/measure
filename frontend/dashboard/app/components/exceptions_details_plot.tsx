"use client"

import { ResponsiveLine } from '@nivo/line'
import { DateTime } from 'luxon'
import { useTheme } from 'next-themes'
import React, { useEffect, useState } from 'react'
import { ExceptionsDetailsPlotApiStatus, ExceptionsType, fetchExceptionsDetailsPlotFromServer } from '../api/api_calls'
import { numberToKMB } from '../utils/number_utils'
import { formatPlotTooltipDate, getPlotTimeGroupNivoConfig } from '../utils/time_utils'
import { chartTheme } from '../utils/shared_styles'
import { getPlotTimeGroupForRange } from '../utils/time_utils'
import { Filters } from './filters'
import LoadingSpinner from './loading_spinner'

const demoDataDate = DateTime.now()
const demoData = [
  {
    id: "1.0.0 (100)",
    data: [
      { datetime: demoDataDate.toFormat('yyyy-MM-dd'), instances: 1796 },
      { datetime: demoDataDate.minus({ days: 1 }).toFormat('yyyy-MM-dd'), instances: 0 },
      { datetime: demoDataDate.minus({ days: 2 }).toFormat('yyyy-MM-dd'), instances: 0 },
      { datetime: demoDataDate.minus({ days: 3 }).toFormat('yyyy-MM-dd'), instances: 0 },
      { datetime: demoDataDate.minus({ days: 4 }).toFormat('yyyy-MM-dd'), instances: 0 },
      { datetime: demoDataDate.minus({ days: 5 }).toFormat('yyyy-MM-dd'), instances: 0 },
      { datetime: demoDataDate.minus({ days: 6 }).toFormat('yyyy-MM-dd'), instances: 0 }
    ]
  },
  {
    id: "2.0.0 (200)",
    data: [
      { datetime: demoDataDate.toFormat('yyyy-MM-dd'), instances: 2204 },
      { datetime: demoDataDate.minus({ days: 1 }).toFormat('yyyy-MM-dd'), instances: 0 },
      { datetime: demoDataDate.minus({ days: 2 }).toFormat('yyyy-MM-dd'), instances: 0 },
      { datetime: demoDataDate.minus({ days: 3 }).toFormat('yyyy-MM-dd'), instances: 0 },
      { datetime: demoDataDate.minus({ days: 4 }).toFormat('yyyy-MM-dd'), instances: 0 },
      { datetime: demoDataDate.minus({ days: 5 }).toFormat('yyyy-MM-dd'), instances: 0 },
      { datetime: demoDataDate.minus({ days: 6 }).toFormat('yyyy-MM-dd'), instances: 0 }
    ]
  }
]

interface ExceptionsDetailsPlotProps {
  exceptionsType: ExceptionsType,
  exceptionsGroupId: string,
  filters: Filters,
  demo?: boolean,
}

type ExceptionsDetailsPlot = {
  id: string
  data: {
    x: string
    y: number
  }[]
}[]

const ExceptionsDetailsPlot: React.FC<ExceptionsDetailsPlotProps> = ({ exceptionsType, exceptionsGroupId, filters, demo = false }) => {
  const [exceptionsDetailsPlotApiStatus, setExceptionsDetailsPlotApiStatus] = useState(ExceptionsDetailsPlotApiStatus.Loading)
  const [plot, setPlot] = useState<ExceptionsDetailsPlot>()
  const [plotDataKey, setPlotDataKey] = useState<string | null>(null)
  const { theme } = useTheme()
  const plotTimeGroup = getPlotTimeGroupForRange(filters.startDate, filters.endDate)
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup)
  const currentPlotKey = `${exceptionsType}|${exceptionsGroupId}|${filters.startDate}|${filters.endDate}|${plotTimeGroup}|${demo ? "demo" : "live"}`
  const shouldRenderPlot = exceptionsDetailsPlotApiStatus === ExceptionsDetailsPlotApiStatus.Success && plot !== undefined && plotDataKey === currentPlotKey

  const getExceptionsDetailsPlot = async () => {
    if (demo) {
      setExceptionsDetailsPlotApiStatus(ExceptionsDetailsPlotApiStatus.Success)
      setPlot(demoData.map((item: any) => ({ id: item.id, data: item.data.map((d: any) => ({ x: d.datetime, y: d.instances })) })))
      setPlotDataKey(currentPlotKey)
      return
    }

    // Don't try to fetch plot if filters aren't ready
    if (!filters.ready) {
      return
    }

    setExceptionsDetailsPlotApiStatus(ExceptionsDetailsPlotApiStatus.Loading)

    const result = await fetchExceptionsDetailsPlotFromServer(exceptionsType, exceptionsGroupId, filters)

    switch (result.status) {
      case ExceptionsDetailsPlotApiStatus.Error:
        setExceptionsDetailsPlotApiStatus(ExceptionsDetailsPlotApiStatus.Error)
        setPlotDataKey(null)
        break
      case ExceptionsDetailsPlotApiStatus.NoData:
        setExceptionsDetailsPlotApiStatus(ExceptionsDetailsPlotApiStatus.NoData)
        setPlotDataKey(null)
        break
      case ExceptionsDetailsPlotApiStatus.Success:
        setExceptionsDetailsPlotApiStatus(ExceptionsDetailsPlotApiStatus.Success)

        // map result data to chart format
        setPlot(result.data.map((item: any) => ({
          id: item.id,
          data: item.data.map((data: any) => ({
            x: data.datetime,
            y: data.instances,
          })),
        })))
        setPlotDataKey(currentPlotKey)
        break
    }
  }

  useEffect(() => {
    getExceptionsDetailsPlot()
  }, [exceptionsType, exceptionsGroupId, filters, demo])

  return (
    <div className="flex font-body items-center justify-center w-full md:w-1/2 h-[32rem]">
      {(exceptionsDetailsPlotApiStatus === ExceptionsDetailsPlotApiStatus.Loading || (exceptionsDetailsPlotApiStatus === ExceptionsDetailsPlotApiStatus.Success && !shouldRenderPlot)) && <LoadingSpinner />}
      {exceptionsDetailsPlotApiStatus === ExceptionsDetailsPlotApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {exceptionsDetailsPlotApiStatus === ExceptionsDetailsPlotApiStatus.NoData && <p className="text-lg font-display text-center p-4">No Data</p>}
      {shouldRenderPlot &&
        <ResponsiveLine
          data={plot!}
          curve="monotoneX"
          theme={chartTheme}
          enableArea={true}
          areaOpacity={0.1}
          colors={{ scheme: theme === 'dark' ? 'tableau10' : 'nivo' }}
          margin={{ top: 40, right: 60, bottom: 180, left: 50 }}
          xFormat={timeConfig.xFormat}
          xScale={{
            format: timeConfig.xScaleFormat,
            precision: timeConfig.xScalePrecision,
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
            format: timeConfig.axisBottomFormat,
            tickRotation: 60,
            legendPosition: 'middle'
          }}
          axisLeft={{
            tickSize: 1,
            tickPadding: 5,
            format: value => Number.isInteger(value) ? numberToKMB(value) : '',
            legend: exceptionsType === ExceptionsType.Crash ? 'Crash instances' : 'ANR instances',
            legendOffset: demo ? -45 : -40,
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
                <p className='p-2'>Date: {formatPlotTooltipDate(slice.points[0].data.xFormatted.toString(), plotTimeGroup)}</p>
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

export default ExceptionsDetailsPlot
