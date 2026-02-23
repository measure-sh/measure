"use client"

import { ResponsiveLine } from '@nivo/line'
import { useTheme } from 'next-themes'
import React, { useEffect, useState } from 'react'
import { BugReportsOverviewPlotApiStatus, fetchBugReportsOverviewPlotFromServer } from '../api/api_calls'
import { formatPlotTooltipDate, getPlotTimeGroupNivoConfig } from '../utils/time_utils'
import { chartTheme } from '../utils/shared_styles'
import { getPlotTimeGroupForRange } from '../utils/time_utils'
import { Filters } from './filters'
import LoadingSpinner from './loading_spinner'

interface BugReportsOverviewPlotProps {
  filters: Filters
}

type BugReportsOverviewPlot = {
  id: string
  data: {
    id: string
    x: string
    y: number
  }[]
}[]

const BugReportsOverviewPlot: React.FC<BugReportsOverviewPlotProps> = ({ filters }) => {
  const [bugReportsOverviewPlotApiStatus, setBugReportsOverviewPlotApiStatus] = useState(BugReportsOverviewPlotApiStatus.Loading)
  const [plot, setPlot] = useState<BugReportsOverviewPlot>()
  const [plotDataKey, setPlotDataKey] = useState<string | null>(null)
  const { theme } = useTheme()
  const plotTimeGroup = getPlotTimeGroupForRange(filters.startDate, filters.endDate)
  const timeConfig = getPlotTimeGroupNivoConfig(plotTimeGroup)
  const currentPlotKey = `${filters.startDate}|${filters.endDate}|${plotTimeGroup}`
  const shouldRenderPlot = bugReportsOverviewPlotApiStatus === BugReportsOverviewPlotApiStatus.Success && plot !== undefined && plotDataKey === currentPlotKey

  const getBugReportsOverviewPlot = async () => {
    // Don't try to fetch plot if filters aren't ready
    if (!filters.ready) {
      return
    }

    setBugReportsOverviewPlotApiStatus(BugReportsOverviewPlotApiStatus.Loading)

    const result = await fetchBugReportsOverviewPlotFromServer(filters)

    switch (result.status) {
      case BugReportsOverviewPlotApiStatus.Error:
        setBugReportsOverviewPlotApiStatus(BugReportsOverviewPlotApiStatus.Error)
        setPlotDataKey(null)
        break
      case BugReportsOverviewPlotApiStatus.NoData:
        setBugReportsOverviewPlotApiStatus(BugReportsOverviewPlotApiStatus.NoData)
        setPlotDataKey(null)
        break
      case BugReportsOverviewPlotApiStatus.Success:
        setBugReportsOverviewPlotApiStatus(BugReportsOverviewPlotApiStatus.Success)

        // map result data to chart format
        let newPlot = result.data.map((item: any) => ({
          id: item.id,
          data: item.data.map((data: any, index: number) => ({
            id: item.id + '.' + index,
            x: data.datetime,
            y: data.instances
          }))
        }))

        setPlot(newPlot)
        setPlotDataKey(currentPlotKey)
        break
    }
  }

  useEffect(() => {
    getBugReportsOverviewPlot()
  }, [filters])

  return (
    <div className="flex font-body items-center justify-center w-full h-[36rem]">
      {(bugReportsOverviewPlotApiStatus === BugReportsOverviewPlotApiStatus.Loading || (bugReportsOverviewPlotApiStatus === BugReportsOverviewPlotApiStatus.Success && !shouldRenderPlot)) && <LoadingSpinner />}
      {bugReportsOverviewPlotApiStatus === BugReportsOverviewPlotApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {bugReportsOverviewPlotApiStatus === BugReportsOverviewPlotApiStatus.NoData && <p className="text-lg font-display text-center p-4">No Data</p>}
      {shouldRenderPlot &&
        <ResponsiveLine
          data={plot!}
          curve="monotoneX"
          theme={chartTheme}
          enableArea={true}
          areaOpacity={0.1}
          colors={{ scheme: theme === 'dark' ? 'tableau10' : 'nivo' }}
          margin={{ top: 40, right: 40, bottom: 140, left: 100 }}
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
          yFormat="d"
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
            format: value => Number.isInteger(value) ? value : '',
            legend: 'Bug Reports',
            legendOffset: -80,
            legendPosition: 'middle'
          }}
          pointSize={6}
          pointBorderWidth={1.5}
          pointColor={theme === 'dark' ? "rgba(0, 0, 0, 255)" : "rgba(255, 255, 255, 255)"}
          pointBorderColor={{
            from: 'serieColor',
            modifiers: [
              [
                'darker',
                0.3
              ]
            ]
          }}
          pointLabelYOffset={-12}
          useMesh={true}
          enableGridX={false}
          enableGridY={false}
          enableSlices="x"
          sliceTooltip={({ slice }) => {
            return (
              <div className="bg-accent text-accent-foreground flex flex-col p-2 text-xs rounded-md">
                <p className='p-2'>Date: {formatPlotTooltipDate(slice.points[0].data.xFormatted.toString(), plotTimeGroup)}</p>
                {slice.points.map((point) => (
                  <div className="flex flex-row items-center p-2" key={point.id}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.serieColor }} />
                    <div className="px-2" />
                    <p>{point.serieId.toString()} - </p>
                    <div className="px-2" />
                    <p>{point.data.yFormatted} {point.data.yFormatted as number > 1 ? "Bug Reports" : "Bug Report"}</p>
                  </div>
                ))}
              </div>
            )
          }}
        />}
    </div>
  )

}

export default BugReportsOverviewPlot
