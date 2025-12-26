"use client"

import { ResponsiveLine } from '@nivo/line'
import { useTheme } from 'next-themes'
import React, { useEffect, useState } from 'react'
import { SpanMetricsPlotApiStatus, fetchSpanMetricsPlotFromServer } from '../api/api_calls'
import { chartTheme } from '../utils/shared_styles'
import { formatDateToHumanReadableDate, formatMillisToHumanReadable } from '../utils/time_utils'
import { Filters } from './filters'
import LoadingSpinner from './loading_spinner'
import TabSelect from './tab_select'

interface SpanMetricsPlotProps {
  filters: Filters
}

type SpanMetricsPlot = {
  id: string
  data: {
    id: string
    x: string
    y: number
  }[]
}[]

enum RootSpanMetricsQuantile {
  p50 = "p50",
  p90 = "p90",
  p95 = "p95",
  p99 = "p99",
}

const SpanMetricsPlot: React.FC<SpanMetricsPlotProps> = ({ filters }) => {
  const [spanMetricsPlotApiStatus, setSpanMetricsPlotApiStatus] = useState(SpanMetricsPlotApiStatus.Loading)
  const [quantile, setQuantile] = useState(RootSpanMetricsQuantile.p95)
  const [spanMetricsPlotApiData, setSpanMetricsPlotApiData] = useState<any>()
  const [plot, setPlot] = useState<SpanMetricsPlot>()
  const { theme } = useTheme()

  function getYBasedOnQuantile(data: any) {
    switch (quantile) {
      case RootSpanMetricsQuantile.p50:
        return data.p50
      case RootSpanMetricsQuantile.p90:
        return data.p90
      case RootSpanMetricsQuantile.p95:
        return data.p95
      case RootSpanMetricsQuantile.p99:
        return data.p99
    }
  }

  function mapQuantileStringToQuantile(quantile: string) {
    switch (quantile) {
      case RootSpanMetricsQuantile.p50:
        return RootSpanMetricsQuantile.p50
      case RootSpanMetricsQuantile.p90:
        return RootSpanMetricsQuantile.p90
      case RootSpanMetricsQuantile.p95:
        return RootSpanMetricsQuantile.p95
      case RootSpanMetricsQuantile.p99:
        return RootSpanMetricsQuantile.p99
    }

    throw "Invalid quantile selected"
  }

  const getSpanMetricsPlot = async () => {
    // Don't try to fetch plot if filters aren't ready
    if (!filters.ready) {
      return
    }

    setSpanMetricsPlotApiStatus(SpanMetricsPlotApiStatus.Loading)

    const result = await fetchSpanMetricsPlotFromServer(filters)

    switch (result.status) {
      case SpanMetricsPlotApiStatus.Error:
        setSpanMetricsPlotApiStatus(SpanMetricsPlotApiStatus.Error)
        break
      case SpanMetricsPlotApiStatus.NoData:
        setSpanMetricsPlotApiStatus(SpanMetricsPlotApiStatus.NoData)
        break
      case SpanMetricsPlotApiStatus.Success:
        setSpanMetricsPlotApiStatus(SpanMetricsPlotApiStatus.Success)
        setSpanMetricsPlotApiData(result.data)
        break
    }
  }

  useEffect(() => {
    getSpanMetricsPlot()
  }, [filters])

  useEffect(() => {
    if (spanMetricsPlotApiStatus !== SpanMetricsPlotApiStatus.Success) {
      return
    }

    const newPlot = spanMetricsPlotApiData.map((item: any) => ({
      id: item.id,
      data: item.data.map((data: any, index: number) => ({
        id: item.id + '.' + index,
        x: data.datetime,
        y: getYBasedOnQuantile(data)
      }))
    }))

    setPlot(newPlot)
  }, [spanMetricsPlotApiData, quantile])

  return (
    <div className="flex font-body items-center justify-center w-full h-[36rem]">
      {spanMetricsPlotApiStatus === SpanMetricsPlotApiStatus.Loading && <LoadingSpinner />}
      {spanMetricsPlotApiStatus === SpanMetricsPlotApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {spanMetricsPlotApiStatus === SpanMetricsPlotApiStatus.NoData && <p className="text-lg font-display text-center p-4">No Data</p>}
      {spanMetricsPlotApiStatus === SpanMetricsPlotApiStatus.Success &&
        <div className='flex flex-col w-full h-full'>
          <div className='flex flex-col w-full items-end p-2'>
            <TabSelect items={Object.values(RootSpanMetricsQuantile)} selected={quantile} onChangeSelected={(item) => setQuantile(mapQuantileStringToQuantile(item as string))} />
          </div>
          <ResponsiveLine
            data={plot!}
            curve="monotoneX"
            theme={chartTheme}
            enableArea={true}
            areaOpacity={0.1}
            colors={{ scheme: theme === 'dark' ? 'tableau10' : 'nivo' }}
            margin={{ top: 20, right: 40, bottom: 140, left: 100 }}
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
            yFormat=".2f"
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
              legend: `Duration (${quantile})`,
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
                      <p>{formatMillisToHumanReadable(point.data.yFormatted as number)} ({quantile})</p>
                    </div>
                  ))}
                </div>
              )
            }}
          />
        </div>}
    </div>
  )

}

export default SpanMetricsPlot