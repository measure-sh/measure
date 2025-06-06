"use client"

import { FilterSource } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import MetricsOverview from '@/app/components/metrics_overview'
import SessionsVsExceptionsPlot from '@/app/components/sessions_vs_exceptions_overview_plot'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PageState {
  filters: typeof defaultFilters
}

export default function Overview({ params }: { params: { teamId: string } }) {
  const router = useRouter()

  const initialState: PageState = {
    filters: defaultFilters,
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

      <div className="py-2" />

      {pageState.filters.ready && (
        <>
          <SessionsVsExceptionsPlot filters={pageState.filters} />
          <div className="py-8" />
          {pageState.filters.ready &&
            <MetricsOverview
              filters={pageState.filters} />}
        </>
      )}
    </div>
  )
}