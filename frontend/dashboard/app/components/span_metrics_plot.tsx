"use client"

import { RootSpanMetricsQuantile, useSpanMetricsPlotQuery } from '@/app/query/hooks'
import { useFiltersStore } from '@/app/stores/provider'
import { ResponsiveLine } from '@nivo/line'
import { useTheme } from 'next-themes'
import React, { useState } from 'react'
import { chartTheme } from '../utils/shared_styles'
import { formatMillisToHumanReadable, formatPlotTooltipDate, getPlotTimeGroupForRange, getPlotTimeGroupNivoConfig } from '../utils/time_utils'
import LoadingSpinner from './loading_spinner'
import TabSelect from './tab_select'

const SpanMetricsPlot: React.FC = () => {
  const filters = useFiltersStore(state => state.filters)
  const [quantile, setQuantile] = useState<RootSpanMetricsQuantile>(RootSpanMetricsQuantile.p50)
  const { data: plot, status } = useSpanMetricsPlotQuery(quantile)
  const { theme } = useTheme()
  const plotTimeGroup = getPlotTimeGroupForRange(filters.startDate, filters.endDate)
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup)

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

  return (
    <div className="flex font-body items-center justify-center w-full h-[36rem]">
      {status === 'pending' && <LoadingSpinner />}
      {status === 'error' && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {status === 'success' && plot === null && <p className="text-lg font-display text-center p-4">No Data</p>}
      {status === 'success' && plot !== null && plot !== undefined &&
        <div className='flex flex-col w-full h-full'>
          <div className='flex flex-col w-full items-end p-2'>
            <TabSelect items={Object.values(RootSpanMetricsQuantile)} selected={quantile} onChangeSelected={(item) => setQuantile(mapQuantileStringToQuantile(item as string))} />
          </div>
          <ResponsiveLine
            data={plot}
            curve="monotoneX"
            theme={chartTheme}
            enableArea={true}
            areaOpacity={0.1}
            colors={{ scheme: theme === 'dark' ? 'tableau10' : 'nivo' }}
            margin={{ top: 20, right: 40, bottom: 140, left: 100 }}
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
            yFormat=".2f"
            axisTop={null}
            axisRight={null}
            axisBottom={{
              legend: 'Date',
              tickPadding: 10,
              legendOffset: 100,
              format: timeConfig.axisBottomFormat,
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
                  <p className='p-2'>Date: {formatPlotTooltipDate(slice.points[0].data.xFormatted.toString(), plotTimeGroup)}</p>
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
