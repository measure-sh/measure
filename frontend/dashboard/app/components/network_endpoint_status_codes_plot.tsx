"use client"

import { ResponsiveLine } from '@nivo/line'
import { useTheme } from 'next-themes'
import React, { useMemo } from 'react'
import { numberToKMB } from '../utils/number_utils'
import { chartTheme } from '../utils/shared_styles'
import { formatPlotTooltipDate, getPlotTimeGroupNivoConfig, PlotTimeGroup } from '../utils/time_utils'

interface Props {
  statusCodes: number[]
  data: { datetime: string; total_count: number;[key: string]: any }[]
  plotTimeGroup: PlotTimeGroup
}

const bucketColorsDark: Record<number, string> = {
  2: '#4e79a7',
  3: '#76b7b2',
  4: '#f28e2c',
  5: '#e15759',
}

const bucketColorsLight: Record<number, string> = {
  2: '#e8c1a0',
  3: '#e8a838',
  4: '#f1e15b',
  5: '#f47560',
}

function getStatusCodeColor(code: number, theme: string | undefined): string {
  const bucket = Math.floor(code / 100)
  const map = theme === 'dark' ? bucketColorsDark : bucketColorsLight
  return map[bucket] || '#888'
}

const NetworkEndpointStatusCodesPlot: React.FC<Props> = ({ statusCodes, data, plotTimeGroup }) => {
  const { theme } = useTheme()
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup)

  const plot = useMemo(() => {
    if (!data || data.length === 0 || !statusCodes || statusCodes.length === 0) return undefined

    return statusCodes.map((code) => ({
      id: String(code),
      data: data.map((d) => ({
        x: d.datetime,
        y: d[`count_${code}`] ?? 0,
        total_count: d.total_count,
      })),
    }))
  }, [data, statusCodes])

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
          colors={({ id }) => getStatusCodeColor(Number(id), theme)}
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
          pointBorderColor={({ serieId }: { serieId: string }) => getStatusCodeColor(Number(serieId), theme)}
          pointLabelYOffset={-12}
          useMesh={true}
          enableGridX={false}
          enableGridY={false}
          enableSlices="x"
          sliceTooltip={({ slice }) => {
            const firstPoint = slice.points[0]?.data as unknown as { xFormatted: string; total_count: number }
            const total = firstPoint?.total_count ?? 0
            const pct = (count: number) => total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
            return (
              <div className="bg-accent text-accent-foreground flex flex-col p-2 text-xs rounded-md">
                <p className='p-2 font-semibold'>{formatPlotTooltipDate(slice.points[0].data.xFormatted.toString(), plotTimeGroup)}</p>
                <p className='px-2 pb-1'>Total: {total.toLocaleString()}</p>
                {[...slice.points].sort((a, b) => Number(a.serieId) - Number(b.serieId)).map((point) => {
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

export default NetworkEndpointStatusCodesPlot
