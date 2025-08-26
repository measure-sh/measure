"use client"

import { ResponsiveBar } from '@nivo/bar'
import React, { useEffect, useState } from 'react'
import { ExceptionsDistributionPlotApiStatus, ExceptionsType, fetchExceptionsDistributionPlotFromServer } from '../api/api_calls'
import { Filters } from './filters'
import LoadingSpinner from './loading_spinner'

interface ExceptionsDistributionPlotProps {
  exceptionsType: ExceptionsType,
  exceptionsGroupId: string,
  filters: Filters
}

type ExceptionsDistributionPlot = {
  attribute: string
  [key: string]: number | string
}[]

const formatAttribute = (str: string, hasAndroidData: boolean = false): string => {
  if (str === 'os_version' && hasAndroidData) {
    return 'API Level'
  }

  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatOsVersionKey = (key: string): string => {
  // Extract OS name and version from the key (e.g., "android 27" -> "Android API Level 27")
  const parts = key.toLowerCase().split(' ')
  if (parts.length >= 2) {
    const osName = parts[0]
    const version = parts[1]

    const displayName = osName === 'android'
      ? 'Android API Level'
      : osName === 'ios'
        ? 'iOS'
        : osName === 'ipados'
          ? 'iPadOS'
          : osName

    return `${displayName} ${version}`
  }
  return key
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
          const transformedValues: { [key: string]: number } = {}
          let hasAndroidData = false

          Object.entries(values as { [key: string]: number }).forEach(([key, value]) => {
            // Check if this is Android data for os_version
            if (attribute === 'os_version' && key.toLowerCase().startsWith('android')) {
              hasAndroidData = true
            }

            // Transform OS version keys for better display
            const transformedKey = attribute === 'os_version' ? formatOsVersionKey(key) : key
            transformedValues[transformedKey] = value

            if (!parsedPlotKeys.includes(transformedKey)) {
              parsedPlotKeys.push(transformedKey)
            }
          })

          return {
            attribute: formatAttribute(attribute, hasAndroidData),
            ...transformedValues,
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
    <div className="flex font-body items-center justify-center w-full h-[32rem]">
      {exceptionsDistributionPlotApiStatus === ExceptionsDistributionPlotApiStatus.Loading && <LoadingSpinner />}
      {exceptionsDistributionPlotApiStatus === ExceptionsDistributionPlotApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {exceptionsDistributionPlotApiStatus === ExceptionsDistributionPlotApiStatus.NoData && <p className="text-lg font-display text-center p-4">No Data</p>}
      {exceptionsDistributionPlotApiStatus === ExceptionsDistributionPlotApiStatus.Success &&
        <ResponsiveBar
          data={plot!}
          keys={plotKeys}
          indexBy="attribute"
          colors={{ scheme: 'nivo' }}
          margin={{ top: 40, right: 0, bottom: 180, left: 60 }}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            legend: 'Attributes',
            tickPadding: 10,
            legendOffset: 100,
            tickRotation: 60,
            legendPosition: 'middle'
          }}
          axisLeft={{
            tickSize: 1,
            tickPadding: 5,
            legend: exceptionsType === ExceptionsType.Crash ? 'Crash instances' : 'ANR instances',
            legendOffset: -50,
            legendPosition: 'middle'
          }}
          enableGridX={false}
          enableGridY={false}
          tooltip={({
            id,
            value,
            color
          }) => {
            return (
              <div className="bg-neutral-800 text-white flex flex-col p-2 text-xs rounded-md">
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