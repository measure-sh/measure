"use client"

import { ResponsiveLine } from '@nivo/line'
import { useTheme } from 'next-themes'
import React, { useEffect, useState } from 'react'
import { chartTheme } from '../utils/shared_styles'
import { formatDateToHumanReadableDate } from '../utils/time_utils'

interface StatusCodeDataPoint {
  datetime: string
  percentage: number | null
}

interface StatusCodeSeries {
  id: string
  data: StatusCodeDataPoint[]
}

interface NetworkStatusCodesPlotProps {
  data: StatusCodeSeries[]
}

type PlotData = {
  id: string
  data: {
    id: string
    x: string
    y: number
  }[]
}[]

const NetworkStatusCodesPlot: React.FC<NetworkStatusCodesPlotProps> = ({ data }) => {
  const [plot, setPlot] = useState<PlotData>()
  const { theme } = useTheme()

  useEffect(() => {
    if (!data) return

    const newPlot = data.map((item) => ({
      id: item.id,
      data: item.data.map((d, index) => ({
        id: item.id + '.' + index,
        x: d.datetime,
        y: d.percentage ?? 0
      }))
    }))

    setPlot(newPlot)
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
        yFormat=".1f"
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
          format: value => `${value}%`,
          legend: 'Percentage (%)',
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
        sliceTooltip={({ slice }) => (
          <div className="bg-accent text-accent-foreground flex flex-col p-2 text-xs rounded-md">
            <p className='p-2'>Date: {formatDateToHumanReadableDate(slice.points[0].data.xFormatted.toString())}</p>
            {slice.points.map((point) => (
              <div className="flex flex-row items-center p-2" key={point.id}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                <div className="px-2" />
                <p>Status {point.serieId.toString()} - </p>
                <div className="px-2" />
                <p>{point.data.yFormatted}%</p>
              </div>
            ))}
          </div>
        )}
      />
    </div>
  )
}

export default NetworkStatusCodesPlot
