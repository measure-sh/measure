"use client"

import { ResponsiveHeatMapCanvas } from '@nivo/heatmap'
import { useTheme } from 'next-themes'
import React, { useEffect, useMemo, useState } from 'react'
import { Slider } from '@/app/components/slider'
import { formatMillisToHumanReadable } from '@/app/utils/time_utils'

export interface NetworkTimelineDataPoint {
  elapsed: number
  domain: string
  path_pattern: string
  count: number
}

export interface NetworkTimelineData {
  interval: number
  points: NetworkTimelineDataPoint[]
}

interface Props {
  data: NetworkTimelineData
}

const NetworkTimelinePlot: React.FC<Props> = ({ data }) => {
  const { theme } = useTheme()
  const foreground = theme === 'dark' ? '#ffffff' : '#000000'
  const interval = data.interval

  const canvasTheme = useMemo(() => ({
    text: { fill: foreground },
    axis: { ticks: { text: { fill: foreground } } },
    legends: { text: { fill: foreground } },
  }), [foreground])

  const { heatmapData, minBucket, maxBucket } = useMemo(() => {
    if (!data.points || data.points.length === 0) return { heatmapData: [], minBucket: 0, maxBucket: 0 }

    // Compute total count per endpoint
    const endpointTotals = new Map<string, number>()
    for (const d of data.points) {
      const key = `${d.domain}${d.path_pattern}`
      endpointTotals.set(key, (endpointTotals.get(key) ?? 0) + d.count)
    }

    // Sort endpoints by total count descending
    const sorted = Array.from(endpointTotals.entries())
      .sort((a, b) => b[1] - a[1])

    // Group by endpoint and bucket (already aligned from backend)
    const bucketMap = new Map<string, Map<number, number>>()
    let min = Infinity
    let max = -Infinity

    for (const d of data.points) {
      const endpoint = `${d.domain}${d.path_pattern}`

      min = Math.min(min, d.elapsed)
      max = Math.max(max, d.elapsed)

      let epBuckets = bucketMap.get(endpoint)
      if (!epBuckets) {
        epBuckets = new Map()
        bucketMap.set(endpoint, epBuckets)
      }
      epBuckets.set(d.elapsed, (epBuckets.get(d.elapsed) ?? 0) + d.count)
    }

    if (min === Infinity) return { heatmapData: [], minBucket: 0, maxBucket: 0 }

    // Build all bucket labels
    const allBuckets: number[] = []
    for (let b = min; b <= max; b += interval) {
      allBuckets.push(b)
    }

    // Build heatmap series sorted by total count descending (busiest at top)
    const heatmapData = sorted.map(([endpoint]) => {
      const epBuckets = bucketMap.get(endpoint) ?? new Map()
      return {
        id: endpoint,
        data: allBuckets.map(b => ({
          x: formatMillisToHumanReadable(b * 1000),
          y: epBuckets.get(b) ?? null,
          rangeLabel: `${formatMillisToHumanReadable(b * 1000)} - ${formatMillisToHumanReadable((b + interval) * 1000)}`,
        })),
      }
    })

    return { heatmapData, minBucket: min, maxBucket: max }
  }, [data, interval])

  const sliderMin = Math.min(minBucket + 60, maxBucket)
  const defaultEnd = Math.min(minBucket + 120 - interval, maxBucket)
  const [rangeEnd, setRangeEnd] = useState(defaultEnd)
  const [debouncedRangeEnd, setDebouncedRangeEnd] = useState(defaultEnd)

  useEffect(() => {
    const end = Math.min(minBucket + 120 - interval, maxBucket)
    setRangeEnd(end)
    setDebouncedRangeEnd(end)
  }, [minBucket, maxBucket])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedRangeEnd(rangeEnd), 50)
    return () => clearTimeout(timer)
  }, [rangeEnd])

  const handleRangeChange = (value: number) => {
    setRangeEnd(value)
  }

  const filteredHeatmapData = useMemo(() => {
    const endIndex = Math.floor((debouncedRangeEnd - minBucket) / interval) + 1
    return heatmapData.map(series => ({
      ...series,
      data: series.data.slice(0, endIndex),
    }))
  }, [heatmapData, minBucket, debouncedRangeEnd, interval])

  const containerHeight = Math.min(576, Math.max(200, filteredHeatmapData.length * 40 + 160))

  if (filteredHeatmapData.length === 0) {
    return (
      <div className="flex font-body items-center justify-center w-full h-[36rem]">
        <p className="text-lg font-display text-center p-4">No Data</p>
      </div>
    )
  }

  // Show every Nth tick label to avoid crowding
  const totalBuckets = filteredHeatmapData[0]?.data.length ?? 0
  const tickInterval = Math.max(1, Math.ceil(totalBuckets / 20))
  const tickValues = filteredHeatmapData[0]?.data
    .map(d => d.x)
    .filter((_, i) => i % tickInterval === 0) ?? []

  return (
    <div className="flex font-body flex-col items-center w-full">
      {maxBucket > minBucket && (
        <div className="flex flex-col gap-2 w-full py-4">
          <div className="flex items-center text-muted-foreground justify-end">
            <label className="font-body text-xs">Showing {formatMillisToHumanReadable((rangeEnd + interval) * 1000)} from session start</label>
          </div>
          <Slider
            value={[rangeEnd]}
            onValueChange={(value) => handleRangeChange(value[0])}
            min={sliderMin}
            max={maxBucket}
            step={interval}
            className="w-full"
          />
        </div>
      )}
      <div className="w-full" style={{ height: containerHeight }}>
        <ResponsiveHeatMapCanvas
          data={filteredHeatmapData}
          theme={canvasTheme}
          colors={theme === 'dark'
            ? { type: 'diverging', colors: ['#c5d7e2', '#6baed6', '#2171b5'] }
            : { type: 'diverging', colors: ['#fee6ce', '#fdae6b', '#e6550d'] }
          }
          emptyColor={theme === 'dark' ? '#1a1a1a' : '#f9f9f9'}
          opacity={1}
          activeOpacity={1}
          inactiveOpacity={theme === 'dark' ? 0.90 : 0.70}
          borderWidth={1}
          borderColor={theme === 'dark' ? '#000000' : '#ffffff'}
          margin={{ top: 20, right: 40, bottom: 120, left: 180 }}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            legend: 'Time Since Session Start',
            legendPosition: 'middle',
            legendOffset: 100,
            tickPadding: 10,
            tickRotation: 45,
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
            if (cell.value === null) return null
            const rangeLabel = (cell.data as any).rangeLabel as string
            return (
              <div className="bg-accent text-accent-foreground flex flex-col px-3 py-2 text-xs rounded-md mt-4 ml-4">
                <p className='font-semibold'>{cell.serieId}</p>
                <p className='mt-1'>{rangeLabel}</p>
                <p className='mt-0.5'>{cell.value !== null ? Number(cell.value).toFixed(2) : '0'} avg. requests/session</p>
              </div>
            )
          }}
          legends={[]}
        />
      </div>
    </div>
  )
}

export default NetworkTimelinePlot
