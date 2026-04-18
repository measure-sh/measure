"use client"
import { useFiltersStore } from '@/app/stores/provider'

import { FilterSource, emptyBugReportsOverviewResponse } from '@/app/api/api_calls'
import BugReportsOverviewPlot from '@/app/components/bug_reports_overview_plot'
import Filters, { AppVersionsInitialSelectionType } from '@/app/components/filters'
import LoadingBar from '@/app/components/loading_bar'
import Paginator from '@/app/components/paginator'
import { SkeletonListPage } from '@/app/components/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { paginationOffsetUrlKey, useBugReportsOverviewQuery } from '@/app/query/hooks'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from '@/app/utils/time_utils'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const PAGINATION_LIMIT = 5

export default function BugReportsOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const filters = useFiltersStore(state => state.filters)

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
        router.replace(`?${paginationOffsetUrlKey}=${encodeURIComponent(paginationOffset)}&${filters.serialisedFilters!}`, { scroll: false })
    }, [paginationOffset, filters.ready, filters.serialisedFilters])

    const { data: bugReportsOverview = emptyBugReportsOverviewResponse, status, isFetching } = useBugReportsOverviewQuery(paginationOffset)

    const nextPage = () => setPaginationOffset(o => o + PAGINATION_LIMIT)
    const prevPage = () => setPaginationOffset(o => Math.max(0, o - PAGINATION_LIMIT))

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Bug Reports</p>
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
                showSessionTypes={false}
                showOsVersions={true}
                showCountries={true}
                showNetworkTypes={true}
                showNetworkProviders={true}
                showNetworkGenerations={true}
                showLocales={true}
                showDeviceManufacturers={true}
                showDeviceNames={true}
                showBugReportStatus={true}
                showHttpMethods={false}
                showUdAttrs={true}
                showFreeText={true}
                freeTextPlaceholder='Search User ID, Session Id, Bug Report ID or description..' />
            <div className="py-4" />

            {filters.loading && <SkeletonListPage />}

            {/* Error state for bug reports fetch */}
            {filters.ready
                && status === 'error'
                && <p className="text-lg font-display">Error fetching list of bug reports, please change filters, refresh page or select a different app to try again</p>}

            {/* Main bug reports list UI */}
            {filters.ready
                && (status === 'success' || status === 'pending') &&
                <div className="flex flex-col items-center w-full">
                    <BugReportsOverviewPlot />
                    <div className='self-end'>
                        <Paginator
                            prevEnabled={isFetching ? false : bugReportsOverview.meta.previous}
                            nextEnabled={isFetching ? false : bugReportsOverview.meta.next}
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
                                <TableHead className="w-[60%]">Bug Report</TableHead>
                                <TableHead className="w-[20%] text-center">Time</TableHead>
                                <TableHead className="w-[20%] text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bugReportsOverview.results?.map(({ event_id, description, status, app_id, timestamp, matched_free_text, attribute }: any, idx: number) => {
                                const bugReportHref = `/${params.teamId}/bug_reports/${app_id}/${event_id}`
                                return (
                                    <TableRow
                                        key={`${idx}-${event_id}`}
                                        className="font-body"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                router.push(bugReportHref)
                                            }
                                        }}
                                    >
                                        <TableCell className="w-[60%] relative p-0">
                                            <Link
                                                href={bugReportHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-label={`ID: ${event_id}`}
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className="truncate text-xs text-muted-foreground select-none">ID: {event_id}</p>
                                                <div className='py-1' />
                                                <p className='truncate select-none'>{description ? description : "No Description"}</p>
                                                <div className='py-1' />
                                                <p className='text-xs truncate text-muted-foreground select-none'>{attribute.app_version + "(" + attribute.app_build + "), " + (attribute.os_name === 'android' ? 'Android API Level' : attribute.os_name === 'ios' ? 'iOS' : attribute.os_name === 'ipados' ? 'iPadOS' : attribute.os_name) + " " + attribute.os_version + ", " + attribute.device_manufacturer + " " + attribute.device_model}</p>
                                                {matched_free_text !== "" && <p className='p-1 mt-2 text-xs truncate border border-border rounded-md '>{"Matched " + matched_free_text}</p>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[20%] text-center relative p-0">
                                            <Link
                                                href={bugReportHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className='truncate select-none'>{formatDateToHumanReadableDate(timestamp)}</p>
                                                <div className='py-1' />
                                                <p className='text-xs truncate select-none'>{formatDateToHumanReadableTime(timestamp)}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[20%] text-center relative p-0">
                                            <Link
                                                href={bugReportHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4 items-center flex justify-center">
                                                <p className={`w-20 px-2 py-1 rounded-full border text-sm font-body select-none ${status === 0 ? 'border-green-600 dark:border-green-500 text-green-600 dark:text-green-500 bg-green-50 dark:bg-background' : 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-background'}`}>{status === 0 ? 'Open' : 'Closed'}</p>
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
