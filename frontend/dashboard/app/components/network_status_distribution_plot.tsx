"use client"

import { ResponsiveLine } from '@nivo/line'
import { useTheme } from 'next-themes'
import React, { useMemo } from 'react'
import { numberToKMB } from '../utils/number_utils'
import { chartTheme } from '../utils/shared_styles'
import { formatPlotTooltipDate, getPlotTimeGroupNivoConfig, PlotTimeGroup } from '../utils/time_utils'

interface StatusOverviewDataPoint {
  datetime: string
  total_count: number
  count_2xx: number
  count_3xx: number
  count_4xx: number
  count_5xx: number
}

interface NetworkStatusDistributionPlotProps {
  data: StatusOverviewDataPoint[]
  plotTimeGroup: PlotTimeGroup
}

type PlotData = {
  id: string
  data: {
    x: string
    y: number
    total_count: number
    count_2xx: number
    count_3xx: number
    count_4xx: number
    count_5xx: number
  }[]
}[]

const seriesConfig = [
  { key: 'count_2xx', id: '2xx' },
  { key: 'count_3xx', id: '3xx' },
  { key: 'count_4xx', id: '4xx' },
  { key: 'count_5xx', id: '5xx' },
] as const

const NetworkStatusDistributionPlot: React.FC<NetworkStatusDistributionPlotProps> = ({ data, plotTimeGroup }) => {
  const { theme } = useTheme()
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup)

  const colorMap = theme === 'dark' ? {
    '2xx': 'oklch(0.6500 0.1700 145.0000)',
    '3xx': 'oklch(0.6042 0.1238 244.6000)',
    '4xx': 'oklch(0.6664 0.1851 51.8800)',
    '5xx': 'oklch(0.6014 0.1990 26.6000)',
  } : {
    '2xx': 'oklch(85.5% 0.08 145.000)',
    '3xx': 'oklch(90.1% 0.058 230.902)',
    '4xx': 'oklch(89.2% 0.058 55.000)',
    '5xx': 'oklch(80.8% 0.114 19.571)',
  }

  const plot = useMemo<PlotData | undefined>(() => {
    if (!data) return undefined

    return seriesConfig.map(({ key, id }) => ({
      id,
      data: data.map((d) => ({
        x: d.datetime,
        y: d[key],
        total_count: d.total_count,
        count_2xx: d.count_2xx,
        count_3xx: d.count_3xx,
        count_4xx: d.count_4xx,
        count_5xx: d.count_5xx,
      }))
    }))
  }, [data])

  if (!plot || plot.length === 0 || plot[0].data.length === 0) {
    return (
      <div className="flex font-body items-center justify-center w-full h-[36rem]">
        <p className="text-lg font-display text-center p-4">No Data</p>
      </div>
    )
  }

  return (
    <div className="flex font-body items-center justify-center w-full h-[36rem]">
      <div className='flex flex-col w-full h-full'>
        <ResponsiveLine
          data={plot}
          curve="monotoneX"
          theme={chartTheme}
          enableArea={true}
          areaOpacity={0.1}
          colors={({ id }) => colorMap[id as keyof typeof colorMap] || '#888'}
          margin={{ top: 20, right: 80, bottom: 140, left: 80 }}
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
            tickRotation: 45,
            legendPosition: 'middle'
          }}
          axisLeft={{
            tickSize: 1,
            tickPadding: 5,
            format: value => Number.isInteger(value) ? numberToKMB(value) : '',
            legend: 'Requests',
            legendOffset: -60,
            legendPosition: 'middle'
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
            const pointData = slice.points[0]?.data as unknown as {
              xFormatted: string
              total_count: number
              count_2xx: number
              count_3xx: number
              count_4xx: number
              count_5xx: number
            }
            const total = pointData?.total_count ?? 0
            const pct = (count: number) => total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
            return (
              <div className="bg-accent text-accent-foreground flex flex-col p-2 text-xs rounded-md">
                <p className='p-2 font-semibold'>{formatPlotTooltipDate(slice.points[0].data.xFormatted.toString(), plotTimeGroup)}</p>
                <p className='px-2 pb-1'>Total: {total.toLocaleString()}</p>
                {/* nivo orders points by y-value, sort to maintain 2xx, 3xx, 4xx, 5xx order */}
                {[...slice.points].sort((a, b) => a.serieId.toString().localeCompare(b.serieId.toString())).map((point) => {
                  const count = Number(point.data.y)
                  return (
                    <div className="flex flex-row items-center px-2 py-0.5" key={point.id}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                      <div className="px-1" />
                      <p>{point.serieId}: {count.toLocaleString()} ({pct(count)}%)</p>
                    </div>
                  )
                })}
              </div>
            )
          }}
          legends={[]}
        />
      </div>
    </div>
  )
}

export default NetworkStatusDistributionPlot
