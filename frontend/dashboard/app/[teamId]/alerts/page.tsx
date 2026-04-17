"use client"
import { useFiltersStore } from '@/app/stores/provider'

import { FilterSource, emptyAlertsOverviewResponse } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType } from '@/app/components/filters'
import LoadingBar from '@/app/components/loading_bar'
import Paginator from '@/app/components/paginator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { paginationOffsetUrlKey, useAlertsOverviewQuery } from '@/app/query/hooks'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from '@/app/utils/time_utils'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const PAGINATION_LIMIT = 5

export default function AlertsOverview({ params }: { params: { teamId: string } }) {
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
        if (currentTeamId !== params.teamId) {
            return
        }
        router.replace(`?${paginationOffsetUrlKey}=${encodeURIComponent(paginationOffset)}&${filters.serialisedFilters!}`, { scroll: false })
    }, [paginationOffset, filters.ready, filters.serialisedFilters, currentTeamId, params.teamId])

    const { data: alertsOverview = emptyAlertsOverviewResponse, status, isFetching } = useAlertsOverviewQuery(paginationOffset)

    const nextPage = () => setPaginationOffset(o => o + PAGINATION_LIMIT)
    const prevPage = () => setPaginationOffset(o => Math.max(0, o - PAGINATION_LIMIT))

    return (
        <div className="flex flex-col items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Alerts</p>
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Events}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
                showNoData={true}
                showNotOnboarded={true}
                showAppSelector={true}
                showAppVersions={false}
                showDates={true}
                showSessionTypes={false}
                showOsVersions={false}
                showCountries={false}
                showNetworkTypes={false}
                showNetworkProviders={false}
                showNetworkGenerations={false}
                showLocales={false}
                showDeviceManufacturers={false}
                showDeviceNames={false}
                showBugReportStatus={false}
                showHttpMethods={false}
                showUdAttrs={false}
                showFreeText={false}
                freeTextPlaceholder='Search User ID, Session Id, Bug Report ID or description..' />
            <div className="py-4" />

            {/* Error state for alerts fetch */}
            {filters.ready
                && status === 'error'
                && <p className="text-lg font-display">Error fetching list of alerts, please change filters, refresh page or select a different app to try again</p>}

            {/* Main alerts list UI */}
            {filters.ready
                && (status === 'success' || status === 'pending') &&
                <div className="flex flex-col items-center w-full">
                    <div className='self-end'>
                        <Paginator
                            prevEnabled={isFetching ? false : alertsOverview.meta.previous}
                            nextEnabled={isFetching ? false : alertsOverview.meta.next}
                            displayText=''
                            onNext={nextPage}
                            onPrev={prevPage}
                        />
                    </div>
                    <div className={`py-1 w-full ${isFetching ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>
                    <div className="py-4" />
                    <Table className="font-display select-none">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60%]">Alert</TableHead>
                                <TableHead className="w-[20%] text-center">Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {alertsOverview.results?.map(({ id, team_id, app_id, entity_id, type, message, url, created_at, updated_at }: any, idx: number) => {
                                return (
                                    <TableRow
                                        key={`${idx}-${id}`}
                                        className="font-body select-none"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                router.push(url)
                                            }
                                        }}
                                    >
                                        <TableCell className="w-[60%] relative p-0">
                                            <Link
                                                href={url}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-label={`ID: ${id}`}
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className="truncate text-xs text-muted-foreground select-none">ID: {id}</p>
                                                <div className='py-1' />
                                                <p className='truncate select-none'>{message}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[20%] text-center relative p-0">
                                            <Link
                                                href={url}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className='truncate select-none'>{formatDateToHumanReadableDate(created_at)}</p>
                                                <div className='py-1' />
                                                <p className='text-xs truncate select-none'>{formatDateToHumanReadableTime(created_at)}</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>}
        </div>
    )
}
