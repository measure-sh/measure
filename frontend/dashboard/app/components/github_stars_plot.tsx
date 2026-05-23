"use client"

import { useGitHubStarsDailyQuery } from '@/app/query/hooks'
import { ResponsiveLine } from '@nivo/line'
import { useTheme } from 'next-themes'
import React from 'react'
import { chartTheme } from '../utils/shared_styles'
import { SkeletonPlot } from './skeleton'

const GitHubStarsPlot: React.FC = () => {
  const { data: plot, status } = useGitHubStarsDailyQuery()
  const { theme } = useTheme()

  const dayConfig = {
    xFormat: "time:%Y-%m-%d",
    xScaleFormat: "%Y-%m-%d",
    xScalePrecision: "day" as const,
    axisBottomFormat: "%b %d, %Y",
  }

  return (
    <div className="flex font-body items-center justify-center w-full h-[36rem]">
      {status === 'pending' && <SkeletonPlot />}
      {status === 'error' && (
        <p className="text-lg font-display text-center p-4">
          Error fetching GitHub stars, please refresh the page to try again
        </p>
      )}
      {status === 'success' && plot === null && (
        <p className="text-lg font-display text-center p-4">No data yet — star counts are collected daily</p>
      )}
      {status === 'success' && plot !== null && plot !== undefined && (
        <ResponsiveLine
          data={plot}
          curve="monotoneX"
          theme={chartTheme}
          enableArea={true}
          areaOpacity={0.15}
          colors={{ scheme: theme === 'dark' ? 'dark2' : 'nivo' }}
          margin={{ top: 40, right: 40, bottom: 80, left: 100 }}
          xFormat={dayConfig.xFormat}
          xScale={{
            format: dayConfig.xScaleFormat,
            precision: dayConfig.xScalePrecision,
            type: 'time',
            useUTC: false,
          }}
          yScale={{
            type: 'linear',
            min: 'auto',
            max: 'auto',
          }}
          yFormat=">-d"
          axisTop={null}
          axisRight={null}
          axisBottom={{
            legend: 'Date',
            tickPadding: 10,
            legendOffset: 60,
            format: dayConfig.axisBottomFormat,
            tickRotation: 45,
            legendPosition: 'middle',
          }}
          axisLeft={{
            tickSize: 1,
            tickPadding: 5,
            format: value => Number.isInteger(value) ? value : '',
            legend: 'GitHub Stars',
            legendOffset: -80,
            legendPosition: 'middle',
          }}
          pointSize={4}
          pointBorderWidth={1.5}
          pointColor={theme === 'dark' ? "rgba(0, 0, 0, 255)" : "rgba(255, 255, 255, 255)"}
          pointBorderColor={{
            from: 'serieColor',
            modifiers: [['darker', 0.3]],
          }}
          useMesh={true}
          enableGridX={false}
          enableGridY={false}
          enableSlices="x"
          sliceTooltip={({ slice }) => (
            <div className="bg-accent text-accent-foreground flex flex-col p-2 text-xs rounded-md">
              <p className="p-2">
                {new Date(slice.points[0].data.x).toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              {slice.points.map((point) => (
                <div className="flex flex-row items-center p-2" key={point.id}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                  <div className="px-2" />
                  <p>{Number(point.data.y).toLocaleString()} stars</p>
                </div>
              ))}
            </div>
          )}
        />
      )}
    </div>
  )
}

export default GitHubStarsPlot
