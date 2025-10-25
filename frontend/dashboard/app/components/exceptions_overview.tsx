"use client"

import { ExceptionsOverviewApiStatus, ExceptionsType, FilterSource, emptyExceptionsOverviewResponse, fetchExceptionsOverviewFromServer } from '@/app/api/api_calls'
import Paginator from '@/app/components/paginator'
import { useAIChatContext } from '@/app/context/ai_chat_context'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import ExceptionsOverviewPlot from './exceptions_overview_plot'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from './filters'
import LoadingBar from './loading_bar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'

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
  const { setPageContext } = useAIChatContext()

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

    if (updatedFilters.app?.id) {
      setPageContext({
        appId: updatedFilters.app!.id,
        enable: false,
        fileName: "",
        action: "",
        content: ""
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
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl max-w-6xl text-center">{exceptionsType === ExceptionsType.Crash ? 'Crashes' : 'ANRs'}</p>
      <div className="py-4" />

      <Filters
        teamId={teamId}
        filterSource={exceptionsType === ExceptionsType.Crash ? FilterSource.Crashes : FilterSource.Anrs}
        appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
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
          <ExceptionsOverviewPlot
            exceptionsType={exceptionsType}
            filters={pageState.filters}
          />
          <div className="self-end">
            <Paginator
              prevEnabled={pageState.exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Loading ? false : pageState.exceptionsOverview.meta.previous}
              nextEnabled={pageState.exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Loading ? false : pageState.exceptionsOverview.meta.next}
              displayText=""
              onNext={handleNextPage}
              onPrev={handlePrevPage}
            />
          </div>
          <div className={`py-1 w-full ${pageState.exceptionsOverviewApiStatus === ExceptionsOverviewApiStatus.Loading ? 'visible' : 'invisible'}`}>
            <LoadingBar />
          </div>
          <div className='py-4' />
          <Table className='font-display'>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60%]">{exceptionsType === ExceptionsType.Crash ? 'Crash' : 'ANR'}</TableHead>
                <TableHead className="w-[20%] text-center">Instances</TableHead>
                <TableHead className="w-[20%] text-center">Percentage contribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageState.exceptionsOverview.results?.map(
                ({
                  id,
                  type,
                  message,
                  method_name,
                  file_name,
                  count,
                  percentage_contribution
                }, idx) => {
                  // Get date range, start date and end date from searchParams
                  const d = searchParams.get('d')
                  const sd = searchParams.get('sd')
                  const ed = searchParams.get('ed')
                  // Build query string for timestamps if present
                  const timestampQuery = [sd ? `sd=${encodeURIComponent(sd)}` : null, ed ? `ed=${encodeURIComponent(ed)}` : null, d ? `d=${encodeURIComponent(d)}` : null].filter(Boolean).join('&')
                  // Build base path
                  const basePath = `/${teamId}/${exceptionsType === ExceptionsType.Crash ? 'crashes' : 'anrs'}/${pageState.filters.app!.id}/${id}/${type + (file_name !== '' ? '@' + file_name : '')}`
                  // Final href with query params if any
                  const href = timestampQuery ? `${basePath}?${timestampQuery}` : basePath
                  return (
                    <TableRow
                      key={`${idx}-${id}`}
                      className="font-body hover:bg-yellow-200 focus-visible:border-yellow-200 select-none cursor-pointer"
                    >
                      <TableCell className="w-[60%] relative p-0">
                        <Link
                          href={href}
                          className="absolute inset-0 z-10"
                          aria-label={`${file_name !== '' ? file_name : 'unknown_file'}: ${method_name !== '' ? method_name : 'unknown_method'}()`}
                        />
                        <div className="pointer-events-none p-4">
                          <p className="truncate select-none">
                            {(file_name !== '' ? file_name : 'unknown_file') + ': ' + (method_name !== '' ? method_name : 'unknown_method') + '()'}
                          </p>
                          <div className="py-1" />
                          <p className="text-xs truncate text-gray-500 select-none">
                            {`${type}${message ? `:${message}` : ''}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="w-[20%] text-center truncate select-none relative p-0">
                        <Link
                          href={href}
                          className="absolute inset-0 z-10"
                          aria-hidden="true"
                        />
                        <div className="pointer-events-none p-4">
                          {count}
                        </div>
                      </TableCell>
                      <TableCell className="w-[20%] text-center truncate select-none relative p-0">
                        <Link
                          href={href}
                          className="absolute inset-0 z-10"
                          aria-hidden="true"
                        />
                        <div className="pointer-events-none p-4">
                          {percentage_contribution}%
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }
              )}
            </TableBody>
          </Table>
          <div className='py-4' />
        </div>}
    </div >
  )
}