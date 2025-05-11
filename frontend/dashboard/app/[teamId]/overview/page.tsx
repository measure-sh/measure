"use client"

import React, { useEffect, useState } from 'react'
import Journey, { JourneyType } from "@/app/components/journey"
import MetricsOverview from '@/app/components/metrics_overview'
import { FilterSource } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import { useRouter } from 'next/navigation'

interface PageState {
  filters: typeof defaultFilters
}

export default function Overview({ params }: { params: { teamId: string } }) {
  const router = useRouter()

  const initialState: PageState = {
    filters: defaultFilters
  }

  const [pageState, setPageState] = useState<PageState>(initialState)

  const updatePageState = (newState: Partial<PageState>) => {
    setPageState(prevState => {
      const updatedState = { ...prevState, ...newState }
      return updatedState
    })
  }

  const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
    // update filters only if they have changed
    if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
      updatePageState({
        filters: updatedFilters
      })
    }
  }

  useEffect(() => {
    if (!pageState.filters.ready) {
      return
    }

    // update url
    router.replace(`?${pageState.filters.serialisedFilters!}`, { scroll: false })
  }, [pageState.filters])

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl max-w-6xl text-center">Overview</p>
      <div className="py-4" />

      <Filters
        teamId={params.teamId}
        filterSource={FilterSource.Events}
        appVersionsInitialSelectionType={AppVersionsInitialSelectionType.Latest}
        showCreateApp={true}
        showNoData={true}
        showNotOnboarded={true}
        showAppSelector={true}
        showAppVersions={true}
        showDates={true}
        showSessionType={false}
        showOsVersions={false}
        showCountries={false}
        showNetworkTypes={false}
        showNetworkProviders={false}
        showNetworkGenerations={false}
        showLocales={false}
        showDeviceManufacturers={false}
        showDeviceNames={false}
        showBugReportStatus={false}
        showFreeText={false}
        showUdAttrs={false}
        onFiltersChanged={handleFiltersChanged} />

      <div className="py-4" />

      {pageState.filters.ready &&
        <div className='w-full h-[700px]'>
          <Journey
            teamId={params.teamId}
            bidirectional={false}
            journeyType={JourneyType.Overview}
            exceptionsGroupId={null}
            filters={pageState.filters} />
        </div>
      }
      <div className="py-8" />

      {pageState.filters.ready &&
        <MetricsOverview
          filters={pageState.filters} />}
    </div>
  )
}