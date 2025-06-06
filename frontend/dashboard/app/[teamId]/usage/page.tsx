"use client"

import { FetchUsageApiStatus, emptyUsage, fetchUsageFromServer } from '@/app/api/api_calls'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import LoadingSpinner from '@/app/components/loading_spinner'
import { ResponsivePie } from '@nivo/pie'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Overview({ params }: { params: { teamId: string } }) {
  type AppMonthlyUsage = {
    id: string
    label: string
    value: number
    events: number
    traces: number
    spans: number
  }

  const [fetchUsageApiStatus, setFetchUsageApiStatus] = useState(FetchUsageApiStatus.Loading)
  const [usage, setUsage] = useState(emptyUsage)
  const [months, setMonths] = useState<string[]>()
  const [selectedMonth, setSelectedMonth] = useState<string>()
  const [selectedMonthUsage, setSelectedMonthUsage] = useState<AppMonthlyUsage[]>()

  function parseMonths(data: typeof emptyUsage): string[] {
    const monthYearSet: Set<string> = new Set()

    data.forEach(app => {
      app.monthly_app_usage.forEach(u => {
        monthYearSet.add(u.month_year)
      })
    })

    return Array.from(monthYearSet)
  }

  function parseUsageForMonth(usage: typeof emptyUsage, month: string): AppMonthlyUsage[] {
    const selectedMonthUsages: AppMonthlyUsage[] = []

    usage.forEach(app => {
      app.monthly_app_usage.forEach(u => {
        if (u.month_year === month) {
          selectedMonthUsages.push({ id: app.app_id, label: app.app_name, value: u.session_count, events: u.event_count, traces: u.trace_count, spans: u.span_count })
        }
      })
    })
    return selectedMonthUsages
  }

  const getUsage = async () => {
    setFetchUsageApiStatus(FetchUsageApiStatus.Loading)

    const result = await fetchUsageFromServer(params.teamId)

    switch (result.status) {
      case FetchUsageApiStatus.NoApps:
        setFetchUsageApiStatus(FetchUsageApiStatus.NoApps)
        break
      case FetchUsageApiStatus.Error:
        setFetchUsageApiStatus(FetchUsageApiStatus.Error)
        break
      case FetchUsageApiStatus.Success:
        setFetchUsageApiStatus(FetchUsageApiStatus.Success)
        setUsage(result.data)
        let months = parseMonths(result.data)
        let initialMonth = months[months.length - 1] // set month to last index (latest)
        setMonths(months)
        setSelectedMonth(initialMonth)
        setSelectedMonthUsage(parseUsageForMonth(result.data, initialMonth))
        break
    }
  }

  useEffect(() => {
    getUsage()
  }, [])

  useEffect(() => {
    setSelectedMonthUsage(parseUsageForMonth(usage, selectedMonth!))
  }, [selectedMonth])

  // @ts-ignore
  const CenteredMetric = ({ centerX, centerY }) => {
    let totalSessions = 0
    let totalEvents = 0
    let totalTraces = 0
    let totalSpans = 0
    selectedMonthUsage!.forEach(appMonthlyUsage => {
      totalSessions += appMonthlyUsage.value
      totalEvents += appMonthlyUsage.events
      totalTraces += appMonthlyUsage.traces
      totalSpans += appMonthlyUsage.spans
    })

    return (
      <text
        x={centerX}
        y={centerY}
        textAnchor="middle"
        dominantBaseline="central"
        className='font-display font-semibold'
      >
        <tspan className='text-2xl' x={centerX} dy="-0.7em">{totalSessions} Sessions</tspan>
        <tspan className='text-lg' x={centerX} dy="1.4em">{totalEvents} Events</tspan>
        <tspan className='text-lg' x={centerX} dy="1.4em">{totalTraces} Traces</tspan>
        <tspan className='text-lg' x={centerX} dy="1.4em">{totalSpans} Spans</tspan>
      </text>
    )
  }


  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl max-w-6xl text-center">Usage</p>
      <div className="py-4" />

      {/* Error states */}
      {fetchUsageApiStatus === FetchUsageApiStatus.Error && <p className="font-body text-sm">Error fetching usage data, please check if Team ID is valid or refresh page to try again</p>}
      {fetchUsageApiStatus === FetchUsageApiStatus.NoApps && <p className='font-body text-sm'>Looks like you don&apos;t have any apps yet. Get started by <Link className="underline decoration-2 underline-offset-2 decoration-yellow-200 hover:decoration-yellow-500" href={`apps`}>creating your first app!</Link></p>}

      {/* Main UI */}
      {fetchUsageApiStatus === FetchUsageApiStatus.Loading && <LoadingSpinner />}
      {fetchUsageApiStatus === FetchUsageApiStatus.Success &&
        <div className="flex flex-col items-start w-full">
          <DropdownSelect title="Month" type={DropdownSelectType.SingleString} items={months!} initialSelected={selectedMonth!} onChangeSelected={(item) => setSelectedMonth(item as string)} />
          <div className="py-4" />
          <div className='w-full h-[36rem]'>
            <ResponsivePie
              data={selectedMonthUsage!}
              animate
              margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
              innerRadius={0.7}
              enableArcLabels={false}
              arcLinkLabel={d => `${d.label}`}
              padAngle={0.7}
              cornerRadius={3}
              activeOuterRadiusOffset={8}
              colors={{ scheme: 'nivo' }}
              arcLinkLabelsSkipAngle={10}
              arcLinkLabelsThickness={2}
              arcLinkLabelsColor={{ from: 'color' }}
              tooltip={({ datum: { id, label, value, color } }) => {
                return (
                  <div className="bg-neutral-800 text-white flex flex-col py-2 px-4 font-display rounded-md">
                    <p className='text-sm font-semibold' style={{ color: color }}>{label}</p>
                    <div className='py-0.5' />
                    <p className='text-xs'>Sessions: {value}</p>
                    <p className='text-xs'>Events: {selectedMonthUsage?.find((i) => i.id === id)!.events}</p>
                    <p className='text-xs'>Traces: {selectedMonthUsage?.find((i) => i.id === id)!.traces}</p>
                    <p className='text-xs'>Spans: {selectedMonthUsage?.find((i) => i.id === id)!.spans}</p>
                  </div>
                )
              }}
              legends={[]}
              layers={['arcs', 'arcLabels', 'arcLinkLabels', 'legends', CenteredMetric]}
            />
          </div>
        </div>}
    </div>
  )
}
