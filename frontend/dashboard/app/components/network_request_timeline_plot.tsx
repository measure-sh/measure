"use client"

import { ResponsiveScatterPlot } from '@nivo/scatterplot'
import { useTheme } from 'next-themes'
import React, { useMemo } from 'react'
import { chartTheme } from '../utils/shared_styles'

export interface NetworkRequestTimelineDataPoint {
  domain: string
  path_pattern: string
  avg_elapsed_ms: number
  avg_calls_per_session: number
}

interface Props {
  data: NetworkRequestTimelineDataPoint[]
}

function formatDuration(s: number): string {
  if (s < 0.001) return '<1ms'
  if (s < 1) return `${+(s * 1000).toFixed(0)}ms`
  if (s < 60) return `${+s.toFixed(1)}s`
  return `${+(s / 60).toFixed(1)}m`
}

const NetworkRequestTimelinePlot: React.FC<Props> = ({ data }) => {
  const { theme } = useTheme()
  const xTickValues = [
    0.01, 0.05, 0.1, 0.2, 0.5,
    1, 2, 4, 8, 15, 30, 60,
    120, 240, 480, 900, 1800, 3600,
  ]

  const plotData = useMemo(() => {
    if (!data || data.length === 0) return []

    const MAX_DOMAINS = 5

    const domainCounts = new Map<string, number>()
    for (const d of data) {
      domainCounts.set(d.domain, (domainCounts.get(d.domain) ?? 0) + 1)
    }
    const topDomains = new Set(
      Array.from(domainCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_DOMAINS)
        .map(([domain]) => domain)
    )

    const grouped = new Map<string, { x: number; y: number; domain: string; pathPattern: string }[]>()
    for (const d of data) {
      const key = topDomains.has(d.domain) ? d.domain : 'Others'
      const points = grouped.get(key) ?? []
      points.push({
        x: d.avg_elapsed_ms / 1000,
        y: d.avg_calls_per_session,
        domain: d.domain,
        pathPattern: d.path_pattern,
      })
      grouped.set(key, points)
    }

    return Array.from(grouped, ([domain, points]) => ({ id: domain, data: points }))
  }, [data])

  if (plotData.length === 0 || plotData.every((s) => s.data.length === 0)) {
    return (
      <div className="flex font-body items-center justify-center w-full h-[36rem]">
        <p className="text-lg font-display text-center p-4">No Data</p>
      </div>
    )
  }

  return (
    <div className="flex font-body items-center justify-center w-full h-[36rem]">
      <div className='flex flex-col w-full h-full'>
        <ResponsiveScatterPlot
          data={plotData}
          theme={chartTheme}
          margin={{ top: 20, right: 180, bottom: 80, left: 80 }}
          xScale={{ type: 'log', base: 10, min: 0.01, max: 'auto' }}
          yScale={{ type: 'linear', min: 0.8, max: 'auto' }}
          nodeSize={10}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            legend: 'Avg Session Elapsed',
            legendPosition: 'middle',
            legendOffset: 60,
            tickPadding: 10,
            tickValues: xTickValues,
            format: (v) => formatDuration(Number(v)),
          }}
          axisLeft={{
            legend: 'Avg Calls per Session',
            legendPosition: 'middle',
            legendOffset: -60,
            tickPadding: 5,
            tickSize: 1,
          }}
          enableGridX={false}
          enableGridY={false}
          colors={{ scheme: theme === 'dark' ? 'tableau10' : 'nivo' }}
          legends={[
            {
              anchor: 'right',
              direction: 'column',
              translateX: 160,
              itemWidth: 140,
              itemHeight: 20,
              symbolSize: 10,
              symbolShape: 'circle',
            },
          ]}
          tooltip={({ node }) => {
            const d = node.data as unknown as { x: number; y: number; domain: string; pathPattern: string }
            return (
              <div className="bg-accent text-accent-foreground flex flex-col p-2 text-xs rounded-md">
                <div className="flex flex-row items-center p-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: node.color }} />
                  <div className="px-1" />
                  <p className='font-semibold'>{d.domain}{d.pathPattern}</p>
                </div>
                <div className="flex flex-row items-center px-2 py-0.5">
                  <p>Avg time since session start: {formatDuration(d.x)}</p>
                </div>
                <div className="flex flex-row items-center px-2 py-0.5">
                  <p>Avg calls per session: {d.y.toFixed(1)}</p>
                </div>
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}

export default NetworkRequestTimelinePlot
