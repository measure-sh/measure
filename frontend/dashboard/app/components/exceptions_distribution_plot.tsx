"use client"

import React, { useEffect, useState } from 'react'
import { ExceptionsDistributionPlotApiStatus, ExceptionsType, fetchExceptionsDistributionPlotFromServer } from '../api/api_calls'
import { Filters } from './filters'
import LoadingSpinner from './loading_spinner'
import { ResponsiveBar } from '@nivo/bar'

interface ExceptionsDistributionPlotProps {
  exceptionsType: ExceptionsType,
  exceptionsGroupId: string,
  filters: Filters
}

type ExceptionsDistributionPlot = {
  attribute: string
  [key: string]: number | string
}[]

const formatAttribute = (str: string): string => {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const ExceptionsDistributionPlot: React.FC<ExceptionsDistributionPlotProps> = ({ exceptionsType, exceptionsGroupId, filters }) => {
  const [exceptionsDistributionPlotApiStatus, setExceptionsDistributionPlotApiStatus] = useState(ExceptionsDistributionPlotApiStatus.Loading)
  const [plotKeys, setPlotKeys] = useState<string[]>([])
  const [plot, setPlot] = useState<ExceptionsDistributionPlot>()

  const getExceptionsDistributionPlot = async () => {
    // Don't try to fetch plot if filters aren't ready
    if (!filters.ready) {
      return
    }

    setExceptionsDistributionPlotApiStatus(ExceptionsDistributionPlotApiStatus.Loading)

    const result = await fetchExceptionsDistributionPlotFromServer(exceptionsType, exceptionsGroupId, filters)

    switch (result.status) {
      case ExceptionsDistributionPlotApiStatus.Error:
        setExceptionsDistributionPlotApiStatus(ExceptionsDistributionPlotApiStatus.Error)
        break
      case ExceptionsDistributionPlotApiStatus.NoData:
        setExceptionsDistributionPlotApiStatus(ExceptionsDistributionPlotApiStatus.NoData)
        break
      case ExceptionsDistributionPlotApiStatus.Success:
        setExceptionsDistributionPlotApiStatus(ExceptionsDistributionPlotApiStatus.Success)

        // map result data to chart format
        const parsedPlotKeys: string[] = []
        const parsedPlot = Object.entries(result.data).map(([attribute, values]) => {
          Object.keys(values as { [key: string]: number }).forEach(key => {
            if (!parsedPlotKeys.includes(key)) {
              parsedPlotKeys.push(key)
            }
          })

          return {
            attribute: formatAttribute(attribute),
            ...(values as { [key: string]: number }),
          }
        })

        setPlot(parsedPlot)
        setPlotKeys(parsedPlotKeys)
        break
    }
  }

  useEffect(() => {
    getExceptionsDistributionPlot()
  }, [exceptionsType, exceptionsGroupId, filters])

  return (
    <div className="flex border border-black font-body items-center justify-center w-full h-[32rem]">
      {exceptionsDistributionPlotApiStatus === ExceptionsDistributionPlotApiStatus.Loading && <LoadingSpinner />}
      {exceptionsDistributionPlotApiStatus === ExceptionsDistributionPlotApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {exceptionsDistributionPlotApiStatus === ExceptionsDistributionPlotApiStatus.NoData && <p className="text-lg font-display text-center p-4">No Data</p>}
      {exceptionsDistributionPlotApiStatus === ExceptionsDistributionPlotApiStatus.Success &&
        <ResponsiveBar
          data={plot!}
          keys={plotKeys}
          indexBy="attribute"
          colors={{ scheme: 'nivo' }}
          margin={{ top: 40, right: 60, bottom: 140, left: 60 }}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            legend: 'Attributes',
            tickPadding: 10,
            legendOffset: 120,
            tickRotation: 60,
            legendPosition: 'middle'
          }}
          axisLeft={{
            tickSize: 1,
            tickPadding: 5,
            legend: exceptionsType === ExceptionsType.Crash ? 'Crash instances' : 'ANR instances',
            legendOffset: -40,
            legendPosition: 'middle'
          }}
          tooltip={({
            id,
            value,
            color
          }) => {
            return (
              <div className="bg-neutral-950 text-white flex flex-col p-2 text-xs">
                <div className="flex flex-row items-center p-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <div className="px-2" />
                  <p>{id} - </p>
                  <div className="px-2" />
                  <p>{value} {value > 1 ? 'instances' : 'instance'}</p>
                </div>
              </div>
            )
          }}
        />}
    </div>
  )

}

export default ExceptionsDistributionPlot