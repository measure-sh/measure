"use client"

import { ResponsiveScatterPlot } from '@nivo/scatterplot'
import { useTheme } from 'next-themes'
import React, { useMemo } from 'react'
import { chartTheme } from '../utils/shared_styles'

export interface NetworkRequestTimelineDataPoint {
  domain: string
  path_pattern: string
  p95_elapsed_ms: number
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
  const { series, endpointLabels } = useMemo(() => {
    if (!data || data.length === 0) return { series: [], endpointLabels: new Map<number, string>() }

    const MAX_DOMAINS = 5

    const endpointLabels = new Map<number, string>()
    data.forEach((d, i) => {
      endpointLabels.set(i, `${d.domain}${d.path_pattern}`)
    })

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
    data.forEach((d, i) => {
      const key = topDomains.has(d.domain) ? d.domain : 'Others'
      const points = grouped.get(key) ?? []
      points.push({
        x: d.p95_elapsed_ms / 1000,
        y: i,
        domain: d.domain,
        pathPattern: d.path_pattern,
      })
      grouped.set(key, points)
    })

    const series = Array.from(grouped, ([domain, points]) => ({ id: domain, data: points }))
    return { series, endpointLabels }
  }, [data])

  if (series.length === 0 || series.every((s) => s.data.length === 0)) {
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
          data={series}
          theme={chartTheme}
          margin={{ top: 20, right: 180, bottom: 80, left: 300 }}
          xScale={{ type: 'linear', min: 0, max: 'auto' }}
          yScale={{ type: 'linear', min: -0.5, max: data.length - 0.5 }}
          nodeSize={10}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            legend: 'Time Elapsed Since Session Start',
            legendPosition: 'middle',
            legendOffset: 60,
            tickPadding: 10,
            format: (v) => formatDuration(Number(v)),
          }}
          axisLeft={{
            tickPadding: 5,
            tickSize: 0,
            tickValues: Array.from(endpointLabels.keys()),
            format: (v) => endpointLabels.get(Number(v)) ?? '',
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
                  <p>Time since session start (p95): {formatDuration(d.x)}</p>
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
