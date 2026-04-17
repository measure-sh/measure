"use client"

import { ExceptionsType, FilterSource, emptyExceptionsOverviewResponse } from '@/app/api/api_calls'
import Paginator from '@/app/components/paginator'
import { paginationOffsetUrlKey, useExceptionsOverviewQuery } from '@/app/query/hooks'
import { useFiltersStore } from '@/app/stores/provider'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import ExceptionsOverviewPlot from './exceptions_overview_plot'
import Filters, { AppVersionsInitialSelectionType } from './filters'
import LoadingBar from './loading_bar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'

const PAGINATION_LIMIT = 5

interface ExceptionsOverviewProps {
  exceptionsType: ExceptionsType,
  teamId: string,
}

export const ExceptionsOverview: React.FC<ExceptionsOverviewProps> = ({ exceptionsType, teamId }) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const filters = useFiltersStore(state => state.filters)
  const currentTeamId = useFiltersStore(state => state.currentTeamId)

  // Pagination is component-local state, initialized from URL
  const [paginationOffset, setPaginationOffset] = useState(() => {
    const po = searchParams.get(paginationOffsetUrlKey)
    return po ? parseInt(po) : 0
  })

  // Reset pagination when filters change (skip pre-ready transitions)
  const prevFiltersRef = useRef<string | null>(null)
  useEffect(() => {
    if (!filters.ready) return
    if (prevFiltersRef.current !== null && prevFiltersRef.current !== filters.serialisedFilters) {
      setPaginationOffset(0)
    }
    prevFiltersRef.current = filters.serialisedFilters
  }, [filters.ready, filters.serialisedFilters])

  // URL sync
  useEffect(() => {
    if (!filters.ready) {
      return
    }
    if (currentTeamId !== teamId) {
      return
    }
    router.replace(`?${paginationOffsetUrlKey}=${encodeURIComponent(paginationOffset)}&${filters.serialisedFilters!}`, { scroll: false })
  }, [paginationOffset, filters.ready, filters.serialisedFilters, currentTeamId, teamId])

  const { data: exceptionsOverview = emptyExceptionsOverviewResponse, status, isFetching } = useExceptionsOverviewQuery(exceptionsType, paginationOffset)

  const nextPage = () => setPaginationOffset(o => o + PAGINATION_LIMIT)
  const prevPage = () => setPaginationOffset(o => Math.max(0, o - PAGINATION_LIMIT))

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start">
      <p className="font-display text-4xl max-w-6xl text-center">{exceptionsType === ExceptionsType.Crash ? 'Crashes' : 'ANRs'}</p>
      <div className="py-4" />

      <Filters
        teamId={teamId}
        filterSource={exceptionsType === ExceptionsType.Crash ? FilterSource.Crashes : FilterSource.Anrs}
        appVersionsInitialSelectionType={AppVersionsInitialSelectionType.Latest}
        showNoData={true}
        showNotOnboarded={true}
        showAppSelector={true}
        showAppVersions={true}
        showDates={true}
        showSessionTypes={false}
        showOsVersions={true}
        showCountries={true}
        showNetworkTypes={true}
        showNetworkProviders={true}
        showNetworkGenerations={true}
        showLocales={true}
        showDeviceManufacturers={true}
        showDeviceNames={true}
        showBugReportStatus={false}
        showHttpMethods={false}
        showUdAttrs={true}
        showFreeText={false} />
      <div className="py-4" />

      {/* Error state for crash groups fetch */}
      {filters.ready
        && status === 'error'
        && <p className="text-lg font-display">Error fetching list of {exceptionsType === ExceptionsType.Crash ? 'crashes' : 'ANRs'}, please change filters, refresh page or select a different app to try again</p>}

      {/* Main crash groups list UI */}
      {filters.ready
        && (status === 'success' || status === 'pending') &&
        <div className="flex flex-col items-center w-full">
          <ExceptionsOverviewPlot
            exceptionsType={exceptionsType}
          />
          <div className="self-end">
            <Paginator
              prevEnabled={isFetching ? false : exceptionsOverview.meta.previous}
              nextEnabled={isFetching ? false : exceptionsOverview.meta.next}
              displayText=""
              onNext={nextPage}
              onPrev={prevPage}
            />
          </div>
          <div className={`py-1 w-full ${isFetching ? 'visible' : 'invisible'}`}>
            <LoadingBar />
          </div>
          <div className='py-4' />
          <Table className='font-display select-none'>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60%]">{exceptionsType === ExceptionsType.Crash ? 'Crash' : 'ANR'}</TableHead>
                <TableHead className="w-[20%] text-center">Instances</TableHead>
                <TableHead className="w-[20%] text-center">Percentage contribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptionsOverview.results?.map(
                ({
                  id,
                  type,
                  message,
                  method_name,
                  file_name,
                  count,
                  percentage_contribution
                }: any, idx: number) => {
                  // Get date range, start date and end date from searchParams
                  const d = searchParams.get('d')
                  const sd = searchParams.get('sd')
                  const ed = searchParams.get('ed')
                  // Build query string for timestamps if present
                  const timestampQuery = [sd ? `sd=${encodeURIComponent(sd)}` : null, ed ? `ed=${encodeURIComponent(ed)}` : null, d ? `d=${encodeURIComponent(d)}` : null].filter(Boolean).join('&')
                  // Build base path
                  const basePath = `/${teamId}/${exceptionsType === ExceptionsType.Crash ? 'crashes' : 'anrs'}/${filters.app!.id}/${id}/${type + (file_name !== '' ? '@' + file_name : '')}`
                  // Final href with query params if any
                  const href = timestampQuery ? `${basePath}?${timestampQuery}` : basePath
                  return (
                    <TableRow
                      key={`${idx}-${id}`}
                      className="font-body"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          router.push(href)
                        }
                      }}
                    >
                      <TableCell className="w-[60%] relative p-0">
                        <Link
                          href={href}
                          className="absolute inset-0 z-10 cursor-pointer"
                          tabIndex={-1}
                          aria-label={`${file_name !== '' ? file_name : 'unknown_file'}: ${method_name !== '' ? method_name : 'unknown_method'}()`}
                          style={{ display: 'block' }}
                        />
                        <div className="pointer-events-none p-4">
                          <p className="truncate select-none">
                            {(file_name !== '' ? file_name : 'unknown_file') + ': ' + (method_name !== '' ? method_name : 'unknown_method') + '()'}
                          </p>
                          <div className="py-1" />
                          <p className="text-xs truncate text-muted-foreground select-none">
                            {`${type}${message ? `:${message}` : ''}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="w-[20%] text-center truncate select-none relative p-0">
                        <Link
                          href={href}
                          className="absolute inset-0 z-10 cursor-pointer"
                          tabIndex={-1}
                          aria-hidden="true"
                          style={{ display: 'block' }}
                        />
                        <div className="pointer-events-none p-4">
                          {count}
                        </div>
                      </TableCell>
                      <TableCell className="w-[20%] text-center truncate select-none relative p-0">
                        <Link
                          href={href}
                          className="absolute inset-0 z-10 cursor-pointer"
                          tabIndex={-1}
                          aria-hidden="true"
                          style={{ display: 'block' }}
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
        </div>}
    </div >
  )
}
