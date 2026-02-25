"use client"

import { ResponsiveLine } from '@nivo/line'
import { useTheme } from 'next-themes'
import React, { useMemo } from 'react'
import { numberToKMB } from '../utils/number_utils'
import { chartTheme } from '../utils/shared_styles'
import { formatPlotTooltipDate, getPlotTimeGroupNivoConfig, PlotTimeGroup } from '../utils/time_utils'

interface FrequencyDataPoint {
  datetime: string
  count: number
}

interface NetworkFrequencyPlotProps {
  data: FrequencyDataPoint[]
  plotTimeGroup: PlotTimeGroup
}

type PlotData = {
  id: string
  data: {
    x: string
    y: number
  }[]
}[]

const NetworkFrequencyPlot: React.FC<NetworkFrequencyPlotProps> = ({ data, plotTimeGroup }) => {
  const { theme } = useTheme()
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup)

  const plot = useMemo<PlotData | undefined>(() => {
    if (!data) return undefined

    return [{
      id: 'Requests',
      data: data.map((d) => ({
        x: d.datetime,
        y: d.count,
      }))
    }]
  }, [data])

  if (!plot || plot.length === 0) {
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
          colors={{ scheme: theme === 'dark' ? 'tableau10' : 'nivo' }}
          margin={{ top: 20, right: 40, bottom: 140, left: 80 }}
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
          pointBorderColor={{
            from: 'serieColor',
            modifiers: [['darker', 0.3]]
          }}
          pointLabelYOffset={-12}
          useMesh={true}
          enableGridX={false}
          enableGridY={false}
          enableSlices="x"
          sliceTooltip={({ slice }) => {
            return (
              <div className="bg-accent text-accent-foreground flex flex-col p-2 text-xs rounded-md">
                <p className='p-2 font-semibold'>{formatPlotTooltipDate(slice.points[0].data.xFormatted.toString(), plotTimeGroup)}</p>
                {slice.points.map((point) => (
                  <div className="flex flex-row items-center px-2 py-0.5" key={point.id}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                    <div className="px-1" />
                    <p>Requests: {Number(point.data.y).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )
          }}
          legends={[]}
        />
      </div>
    </div>
  )
}

export default NetworkFrequencyPlot
