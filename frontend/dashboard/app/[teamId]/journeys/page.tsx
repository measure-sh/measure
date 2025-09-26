"use client"

import { FilterSource } from '@/app/api/api_calls'
import DebounceTextInput from '@/app/components/debounce_text_input'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import Journey, { JourneyType } from '@/app/components/journey'
import TabSelect from '@/app/components/tab_select'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

enum PlotType {
  Paths = "Paths",
  Exceptions = "Exceptions",
}

interface PageState {
  filters: typeof defaultFilters
  plotType: PlotType
  searchText: string
}

export default function UserJourneys({ params }: { params: { teamId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const journeyTypeUrlKey = "jt"

  // Determine initial plot type from URL or default
  const initialPlotType = (() => {
    const jt = searchParams.get(journeyTypeUrlKey)
    if (jt === PlotType.Exceptions) return PlotType.Exceptions
    return PlotType.Paths
  })()

  const initialState: PageState = {
    filters: defaultFilters,
    plotType: initialPlotType,
    searchText: ''
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
    const queryParams = `${journeyTypeUrlKey}=${encodeURIComponent(pageState.plotType)}&${pageState.filters.serialisedFilters!}`
    router.replace(`?${queryParams}`, { scroll: false })
  }, [pageState.filters, pageState.plotType])

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl max-w-6xl text-center">User Journeys</p>
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

      {pageState.filters.ready && (
        <>
          {/* TabSelect for plot type */}
          <div className="w-full flex justify-end pb-2 pr-2">
            <TabSelect
              items={Object.values(PlotType)}
              selected={pageState.plotType}
              onChangeSelected={item => {
                updatePageState({ plotType: item as PlotType })
              }}
            />
          </div>

          {/* Main content area */}
          <div className='w-full h-[800px]'>
            <div className="py-2" />
            <DebounceTextInput className="w-full" id="free-text" placeholder="Search nodes..." initialValue={''} onChange={(it) => setPageState(prev => ({ ...prev, searchText: it }))} />
            <div className="py-4" />

            {pageState.plotType === PlotType.Paths &&
              <Journey
                teamId={params.teamId}
                bidirectional={false}
                journeyType={JourneyType.Paths}
                exceptionsGroupId={null}
                filters={pageState.filters}
                searchText={pageState.searchText}
              />}
            {pageState.plotType === PlotType.Exceptions &&
              <Journey
                teamId={params.teamId}
                bidirectional={false}
                journeyType={JourneyType.Exceptions}
                exceptionsGroupId={null}
                filters={pageState.filters}
                searchText={pageState.searchText}
              />}
          </div>
        </>
      )}
      <div className="py-4" />
    </div>
  )
}