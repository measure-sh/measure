"use client"

import { useExceptionsDistributionPlotQuery } from '@/app/query/hooks'
import { useFiltersStore } from '@/app/stores/provider'
import { ResponsiveBar } from '@nivo/bar'
import { useTheme } from 'next-themes'
import React from 'react'
import { ExceptionsType } from '../api/api_calls'
import { numberToKMB } from '../utils/number_utils'
import { chartTheme } from '../utils/shared_styles'
import LoadingSpinner from './loading_spinner'

const demoDistribution: any = {
  "app_version": {
    "1.0.0 (100)": 1796,
    "2.0.0 (200)": 2204
  },
  "country": {
    "UK": 1200,
    "US": 2800
  },
  "device": {
    "Google - Pixel 7 Pro": 800,
    "Samsung - Galaxy S21": 2500,
    "Motorola - Razr": 700
  },
  "locale": {
    "en-UK": 2544,
    "en-US": 1456
  },
  "network_type": {
    "Wifi": 700,
    "5G": 3300
  },
  "os_version": {
    "android 27": 200,
    "android 33": 3200,
    "android 36": 600
  }
}

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

const parseDemoData = (resultData: any): { parsedPlot: { attribute: string, [key: string]: number | string }[], parsedPlotKeys: string[] } => {
  const parsedPlotKeys: string[] = []
  const parsedPlot = Object.entries(resultData).map(([attribute, values]) => {
    const transformedValues: { [key: string]: number } = {}
    let hasAndroidData = false

    Object.entries(values as { [key: string]: number }).forEach(([key, value]) => {
      if (attribute === 'os_version' && key.toLowerCase().startsWith('android')) {
        hasAndroidData = true
      }

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
  return { parsedPlot, parsedPlotKeys }
}

const { parsedPlot: demoParsedPlot, parsedPlotKeys: demoParsedPlotKeys } = parseDemoData(demoDistribution)

interface ExceptionsDistributionPlotProps {
  exceptionsType: ExceptionsType,
  exceptionsGroupId: string,
  demo?: boolean,
}

const ExceptionsDistributionPlot: React.FC<ExceptionsDistributionPlotProps> = ({ exceptionsType, exceptionsGroupId, demo = false }) => {
  const filters = useFiltersStore(state => state.filters)
  const { data: queryData, status } = useExceptionsDistributionPlotQuery(exceptionsType, exceptionsGroupId)
  const { theme } = useTheme()

  const effectiveStatus = demo ? 'success' : status
  const plot = demo ? demoParsedPlot : queryData?.plot
  const plotKeys = demo ? demoParsedPlotKeys : queryData?.plotKeys

  return (
    <div className="flex font-body items-center justify-center w-full md:w-1/2 h-[32rem]">
      {effectiveStatus === 'pending' && <LoadingSpinner />}
      {effectiveStatus === 'error' && <p className="text-lg font-display text-center p-4">Error fetching plot, please change filters or refresh page to try again</p>}
      {effectiveStatus === 'success' && queryData === null && !demo && <p className="text-lg font-display text-center p-4">No Data</p>}
      {effectiveStatus === 'success' && plot !== undefined && plotKeys !== undefined &&
        <ResponsiveBar
          data={plot}
          keys={plotKeys}
          theme={chartTheme}
          indexBy="attribute"
          colors={{ scheme: theme === 'dark' ? 'tableau10' : 'nivo' }}
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
            format: value => Number.isInteger(value) ? numberToKMB(value) : '',
            legend: exceptionsType === ExceptionsType.Crash ? 'Crash instances' : 'ANR instances',
            legendOffset: demo ? -55 : -50,
            legendPosition: 'middle'
          }}
          labelTextColor={'black'}
          valueFormat={(value) => numberToKMB(value)}
          enableGridX={false}
          enableGridY={false}
          tooltip={({
            id,
            value,
            color
          }) => {
            return (
              <div className="bg-accent text-accent-foreground flex flex-col p-2 text-xs rounded-md">
                <div className="flex flex-row items-center p-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <div className="px-2" />
                  <p>{id} - </p>
                  <div className="px-2" />
                  <p>{numberToKMB(value)} {value > 1 ? 'instances' : 'instance'}</p>
                </div>
              </div>
            )
          }}
        />}
    </div>
  )

}

export default ExceptionsDistributionPlot
