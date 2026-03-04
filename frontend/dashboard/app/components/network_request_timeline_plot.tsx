"use client"

import { ResponsiveHeatMapCanvas } from '@nivo/heatmap'
import { useTheme } from 'next-themes'
import React, { useMemo } from 'react'

export interface NetworkRequestTimelineDataPoint {
  bucket_sec: number
  domain: string
  path_pattern: string
  count: number
}

interface Props {
  data: NetworkRequestTimelineDataPoint[]
}

const BUCKET_SIZE = 5

const NetworkRequestTimelinePlot: React.FC<Props> = ({ data }) => {
  const { theme } = useTheme()
  const foreground = theme === 'dark' ? '#ffffff' : '#000000'

  const canvasTheme = useMemo(() => ({
    text: { fill: foreground },
    axis: { ticks: { text: { fill: foreground } } },
    legends: { text: { fill: foreground } },
  }), [foreground])

  const heatmapData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Compute total count per endpoint
    const endpointTotals = new Map<string, number>()
    for (const d of data) {
      const key = `${d.domain}${d.path_pattern}`
      endpointTotals.set(key, (endpointTotals.get(key) ?? 0) + d.count)
    }

    // Sort endpoints by total count descending
    const sorted = Array.from(endpointTotals.entries())
      .sort((a, b) => b[1] - a[1])

    // Group by endpoint and bucket (already 5-second aligned from backend)
    const bucketMap = new Map<string, Map<number, number>>()
    let minBucket = Infinity
    let maxBucket = -Infinity

    for (const d of data) {
      const endpoint = `${d.domain}${d.path_pattern}`

      minBucket = Math.min(minBucket, d.bucket_sec)
      maxBucket = Math.max(maxBucket, d.bucket_sec)

      let epBuckets = bucketMap.get(endpoint)
      if (!epBuckets) {
        epBuckets = new Map()
        bucketMap.set(endpoint, epBuckets)
      }
      epBuckets.set(d.bucket_sec, (epBuckets.get(d.bucket_sec) ?? 0) + d.count)
    }

    if (minBucket === Infinity) return []

    // Build all bucket labels
    const allBuckets: number[] = []
    for (let b = minBucket; b <= maxBucket; b += BUCKET_SIZE) {
      allBuckets.push(b)
    }

    // Build heatmap series sorted by total count descending (busiest at top)
    return sorted.map(([endpoint]) => {
      const epBuckets = bucketMap.get(endpoint) ?? new Map()
      return {
        id: endpoint,
        data: allBuckets.map(b => ({
          x: `${b}s`,
          y: epBuckets.get(b) ?? null,
        })),
      }
    })
  }, [data])

  const containerHeight = Math.min(576, Math.max(200, heatmapData.length * 40 + 160))

  if (heatmapData.length === 0) {
    return (
      <div className="flex font-body items-center justify-center w-full h-[36rem]">
        <p className="text-lg font-display text-center p-4">No Data</p>
      </div>
    )
  }

  // Show every Nth tick label to avoid crowding
  const totalBuckets = heatmapData[0]?.data.length ?? 0
  const tickInterval = Math.max(1, Math.ceil(totalBuckets / 20))
  const tickValues = heatmapData[0]?.data
    .map(d => d.x)
    .filter((_, i) => i % tickInterval === 0) ?? []

  return (
    <div className="flex font-body items-center justify-center w-full" style={{ height: containerHeight }}>
      <div className='flex flex-col w-full h-full'>
        <ResponsiveHeatMapCanvas
          data={heatmapData}
          theme={canvasTheme}
          colors={theme === 'dark'
            ? { type: 'sequential', colors: ['#1a2a3a', '#4e79a7'] }
            : { type: 'sequential', colors: ['#fde8d0', '#e8a838'] }
          }
          emptyColor={'transparent'}
          opacity={1}
          activeOpacity={1}
          inactiveOpacity={0.85}
          borderWidth={0}
          margin={{ top: 20, right: 20, bottom: 140, left: 180 }}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            legend: 'Time Since Session Start',
            legendPosition: 'middle',
            legendOffset: 60,
            tickPadding: 10,
            tickRotation: 0,
            tickValues,
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            format: (value: string) => value.length > 32 ? value.slice(0, 29) + '...' : value,
          }}
          enableLabels={false}
          hoverTarget="cell"
          tooltip={({ cell }) => {
            const bucketStart = parseInt(cell.data.x as string)
            const bucketEnd = bucketStart + BUCKET_SIZE
            return (
              <div className="bg-accent text-accent-foreground flex flex-col px-3 py-2 text-xs rounded-md mt-4 ml-4">
                <p className='font-semibold'>{cell.serieId}</p>
                <p className='mt-1'>{bucketStart}s &ndash; {bucketEnd}s</p>
                <p className='mt-0.5'>{cell.value !== null ? Number(cell.value).toFixed(2) : '0'} avg. requests/session</p>
              </div>
            )
          }}
          legends={[
            {
              anchor: 'bottom',
              translateX: 0,
              translateY: 120,
              length: 200,
              thickness: 8,
              direction: 'row',
              tickSize: 3,
              tickSpacing: 4,
              title: 'Avg. Requests/Session',
              titleAlign: 'start',
              titleOffset: 4,
            },
          ]}
        />
      </div>
    </div>
  )
}

export default NetworkRequestTimelinePlot
