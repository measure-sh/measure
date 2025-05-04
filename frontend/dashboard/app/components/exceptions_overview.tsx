"use client"

import React, { useState, useEffect } from 'react'
import Link from "next/link"
import { useRouter, useSearchParams } from 'next/navigation'
import { ExceptionsOverviewApiStatus, ExceptionsType, FilterSource, emptyExceptionsOverviewResponse, fetchExceptionsOverviewFromServer } from '@/app/api/api_calls'
import Paginator from '@/app/components/paginator'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from './filters'
import ExceptionsOverviewPlot from './exceptions_overview_plot'
import LoadingBar from './loading_bar'

interface PageState {
  exceptionsOverviewApiStatus: ExceptionsOverviewApiStatus
  filters: typeof defaultFilters
  exceptionsOverview: typeof emptyExceptionsOverviewResponse
  keyId: string | null,
  limit: number
}

interface ExceptionsOverviewProps {
  exceptionsType: ExceptionsType,
  teamId: string,
}

export const ExceptionsOverview: React.FC<ExceptionsOverviewProps> = ({ exceptionsType, teamId }) => {
  const defaultPaginationLimit = 5
  const keyIdUrlKey = "kId"
  const paginationLimitUrlKey = "pl"

  const router = useRouter()
  const searchParams = useSearchParams()

  const initialState: PageState = {
    exceptionsOverviewApiStatus: ExceptionsOverviewApiStatus.Loading,
    filters: defaultFilters,
    exceptionsOverview: emptyExceptionsOverviewResponse,
    keyId: searchParams.get(keyIdUrlKey) ? searchParams.get(keyIdUrlKey) : null,
    limit: searchParams.get(paginationLimitUrlKey) ? parseInt(searchParams.get(paginationLimitUrlKey)!) : defaultPaginationLimit
  }

  const [pageState, setPageState] = useState<PageState>(initialState)

  // Helper function to update page state
  const updatePageState = (newState: Partial<PageState>) => {
    setPageState(prevState => {
      const updatedState = { ...prevState, ...newState }
      return updatedState
    })
  }


  const getExceptionsOverview = async () => {
    updatePageState({ exceptionsOverviewApiStatus: ExceptionsOverviewApiStatus.Loading })

    const result = await fetchExceptionsOverviewFromServer(exceptionsType, pageState.filters, pageState.keyId, pageState.limit)

    switch (result.status) {
      case ExceptionsOverviewApiStatus.Error:
        updatePageState({ exceptionsOverviewApiStatus: ExceptionsOverviewApiStatus.Error })
        break
      case ExceptionsOverviewApiStatus.Success:
        updatePageState({ exceptionsOverviewApiStatus: ExceptionsOverviewApiStatus.Success, exceptionsOverview: result.data })
        break
    }
  }

  const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
    // update filters only if they have changed
    if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
      updatePageState({
        filters: updatedFilters,
        // Reset pagination on filters change if previous filters were not default filters
        keyId: pageState.filters.serialisedFilters && searchParams.get(keyIdUrlKey) ? null : pageState.keyId,
        limit: pageState.filters.serialisedFilters && searchParams.get(paginationLimitUrlKey) ? defaultPaginationLimit : pageState.limit
      })
    }
  }

  const handleNextPage = () => {
    let keyId = null
    if (pageState.exceptionsOverview.results !== null && pageState.exceptionsOverview.results.length > 0) {
      keyId = pageState.exceptionsOverview.results[pageState.exceptionsOverview.results.length - 1].id
    }

    updatePageState({ keyId: keyId, limit: defaultPaginationLimit })
  }

  const handlePrevPage = () => {
    let keyId = null
    if (pageState.exceptionsOverview.results !== null && pageState.exceptionsOverview.results.length > 0) {
      keyId = pageState.exceptionsOverview.results[0].id
    }

    updatePageState({ keyId: keyId, limit: -defaultPaginationLimit })
  }

  useEffect(() => {
    if (!pageState.filters.ready) {
      return
    }

    // update url
    const queryParams = `${pageState.keyId !== null ? `${keyIdUrlKey}=${encodeURIComponent(pageState.keyId)}&` : ''}${paginationLimitUrlKey}=${encodeURIComponent(pageState.limit)}&${pageState.filters.serialisedFilters!}`
    router.replace(`?${queryParams}`, { scroll: false })

    getExceptionsOverview()
  }, [pageState.keyId, pageState.filters])

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display text-4xl max-w-6xl text-center">{exceptionsType === ExceptionsType.Crash ? 'Crashes' : 'ANRs'}</p>
      <div className="py-4" />

      <Filters
        teamId={teamId}
        filterSource={exceptionsType === ExceptionsType.Crash ? FilterSource.Crashes : FilterSource.Anrs}
        appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
        showCreateApp={true}
        showNoData={true}
        showNotOnboarded={true}
        showAppSelector={true}
        showAppVersions={true}
        showDates={true}
        showSessionType={false}
        showOsVersions={true}
        showCountries={true}
        showNetworkTypes={true}
        showNetworkProviders={true}
        showNetworkGenerations={true}
        showLocales={true}
        showDeviceManufacturers={true}
        showDeviceNames={true}
        showBugReportStatus={false}
        showUdAttrs={true}
        showFreeText={false}
        onFiltersChanged={handleFiltersChanged} />
      <div className="py-4" />

      {/* Error state for crash groups fetch */}
      {pageState.filters.ready
        && pageState.exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Error
        && <p className="text-lg font-display">Error fetching list of {exceptionsType === ExceptionsType.Crash ? 'crashes' : 'ANRs'}, please change filters, refresh page or select a different app to try again</p>}

      {/* Main crash groups list UI */}
      {pageState.filters.ready
        && (pageState.exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Success || pageState.exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Loading) &&
        <div className="flex flex-col items-center w-full">
          <div className="py-4" />
          <ExceptionsOverviewPlot
            exceptionsType={exceptionsType}
            filters={pageState.filters} />
          <div className="py-4" />
          <div className='self-end'>
            <Paginator prevEnabled={pageState.exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Loading ? false : pageState.exceptionsOverview.meta.previous} nextEnabled={pageState.exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Loading ? false : pageState.exceptionsOverview.meta.next} displayText=''
              onNext={handleNextPage}
              onPrev={handlePrevPage} />
          </div>
          <div className={`py-1 w-full ${pageState.exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Loading ? 'visible' : 'invisible'}`}>
            <LoadingBar />
          </div>
          <div className="table border border-black rounded-md w-full" style={{ tableLayout: "fixed" }}>
            <div className="table-header-group bg-neutral-950">
              <div className="table-row text-white font-display">
                <div className="table-cell w-96 p-4">{exceptionsType === ExceptionsType.Crash ? 'Crash' : 'ANR'} Name</div>
                <div className="table-cell w-48 p-4 text-center">Instances</div>
                <div className="table-cell w-48 p-4 text-center">Percentage contribution</div>
              </div>
            </div>
            <div className="table-row-group font-body">
              {pageState.exceptionsOverview.results?.map(({ id, type, message, method_name, file_name, line_number, count, percentage_contribution }) => (
                <Link key={id} href={`/${teamId}/${exceptionsType === ExceptionsType.Crash ? 'crashes' : 'anrs'}/${pageState.filters.app!.id}/${id}/${type + (file_name !== "" ? "@" + file_name : "")}`} className="table-row border-b-2 border-black hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300">
                  <div className="table-cell p-4">
                    <p className='truncate'>{(file_name !== "" ? file_name : "unknown_file") + ": " + (method_name !== "" ? method_name : "unknown_method") + "()"}</p>
                    <div className='py-1' />
                    <p className='text-xs truncate text-gray-500'>{`${type}${message ? `:${message}` : ''}`}</p>
                  </div>
                  <div className="table-cell p-4 text-center">{count}</div>
                  <div className="table-cell p-4 text-center">{percentage_contribution}%</div>
                </Link>
              ))}
            </div>
          </div>
        </div>}
    </div >
  )
}
