"use client"

import { ResponsiveLine } from '@nivo/line'
import { useTheme } from 'next-themes'
import React, { useEffect, useState } from 'react'
import { chartTheme } from '../utils/shared_styles'
import { formatDateToHumanReadableDate, formatMillisToHumanReadable } from '../utils/time_utils'
import TabSelect from './tab_select'

interface LatencyDataPoint {
  datetime: string
  p50: number | null
  p90: number | null
  p95: number | null
  p99: number | null
  count: number
}

interface NetworkLatencyPlotProps {
  data: LatencyDataPoint[]
}

type PlotData = {
  id: string
  data: {
    id: string
    x: string
    y: number
    count: number
  }[]
}[]

enum Quantile {
  p50 = "p50",
  p90 = "p90",
  p95 = "p95",
  p99 = "p99",
}

const NetworkLatencyPlot: React.FC<NetworkLatencyPlotProps> = ({ data }) => {
  const [quantile, setQuantile] = useState(Quantile.p95)
  const [plot, setPlot] = useState<PlotData>()
  const { theme } = useTheme()

  useEffect(() => {
    if (!data) return

    const newPlot: PlotData = [{
      id: quantile,
      data: data.map((d, index) => ({
        id: quantile + '.' + index,
        x: d.datetime,
        y: d[quantile] ?? 0,
        count: d.count,
      }))
    }]

    setPlot(newPlot)
  }, [data, quantile])

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
        <div className='flex flex-col w-full items-end p-2'>
          <TabSelect items={Object.values(Quantile)} selected={quantile} onChangeSelected={(item) => setQuantile(item as Quantile)} />
        </div>
        <ResponsiveLine
          data={plot}
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
            modifiers: [['darker', 0.3]]
          }}
          pointLabelYOffset={-12}
          useMesh={true}
          enableGridX={false}
          enableGridY={false}
          enableSlices="x"
          sliceTooltip={({ slice }) => {
            const pointData = slice.points[0]?.data as unknown as { count: number }
            const count = pointData?.count ?? 0
            return (
              <div className="bg-accent text-accent-foreground flex flex-col p-2 text-xs rounded-md">
                <p className='p-2 font-semibold'>{formatDateToHumanReadableDate(slice.points[0].data.xFormatted.toString())}</p>
                <p className='px-2 pb-1'>Requests: {count.toLocaleString()}</p>
                {slice.points.map((point) => (
                  <div className="flex flex-row items-center px-2 py-0.5" key={point.id}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                    <div className="px-1" />
                    <p>{quantile}: {formatMillisToHumanReadable(point.data.yFormatted as number)}</p>
                  </div>
                ))}
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}

export default NetworkLatencyPlot
