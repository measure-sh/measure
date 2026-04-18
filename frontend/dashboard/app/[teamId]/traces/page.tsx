"use client"
import { useFiltersStore } from '@/app/stores/provider'

import { FilterSource, emptySpansResponse } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType } from '@/app/components/filters'
import LoadingBar from '@/app/components/loading_bar'
import Paginator from '@/app/components/paginator'
import { SkeletonListPage } from '@/app/components/skeleton'
import SpanMetricsPlot from '@/app/components/span_metrics_plot'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { paginationOffsetUrlKey, useSpansQuery } from '@/app/query/hooks'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime, formatMillisToHumanReadable } from '@/app/utils/time_utils'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const PAGINATION_LIMIT = 5

export default function TracesOverview({ params }: { params: { teamId: string } }) {
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

    const { data: spans = emptySpansResponse, status, isFetching } = useSpansQuery(paginationOffset)

    const nextPage = () => setPaginationOffset(o => o + PAGINATION_LIMIT)
    const prevPage = () => setPaginationOffset(o => Math.max(0, o - PAGINATION_LIMIT))

    return (
        <div className="flex flex-col items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Traces</p>
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Spans}
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

            {filters.loading && <SkeletonListPage />}

            {/* Error state for sessions fetch */}
            {filters.ready
                && status === 'error'
                && <p className="text-lg font-display">Error fetching list of traces, please change filters, refresh page or select a different app to try again</p>}

            {/* Main root spans list UI */}
            {filters.ready
                && (status === 'success' || status === 'pending') &&
                <div className="flex flex-col items-center w-full">
                    <SpanMetricsPlot />
                    <div className='self-end'>
                        <Paginator
                            prevEnabled={isFetching ? false : spans.meta.previous}
                            nextEnabled={isFetching ? false : spans.meta.next}
                            displayText=''
                            onNext={nextPage}
                            onPrev={prevPage}
                        />
                    </div>

                    <div className={`py-1 w-full ${isFetching ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>
                    <div className='py-4' />
                    <Table className="font-display select-none">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60%]">Trace</TableHead>
                                <TableHead className="w-[20%] text-center">Start Time</TableHead>
                                <TableHead className="w-[10%] text-center">Duration</TableHead>
                                <TableHead className="w-[10%] text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="font-body">
                            {spans.results?.map(({ app_id, span_name, span_id, trace_id, status, start_time, duration, app_version, app_build, os_name, os_version, device_manufacturer, device_model }: any, idx: number) => {
                                const traceHref = `/${params.teamId}/traces/${app_id}/${trace_id}`
                                return (
                                    <TableRow
                                        key={`${idx}-${span_id}`}
                                        className="font-body select-none"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                router.push(traceHref)
                                            }
                                        }}
                                    >
                                        <TableCell className="w-[60%] relative p-0">
                                            <Link
                                                href={traceHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-label={`ID: ${trace_id}`}
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className='text-xs truncate text-muted-foreground select-none'>ID: {trace_id}</p>
                                                <div className='py-1' />
                                                <p className='truncate select-none'>{span_name}</p>
                                                <div className='py-1' />
                                                <p className='text-xs truncate text-muted-foreground select-none'>{`${app_version}(${app_build}), ${(os_name === 'android' ? 'Android API Level' : os_name === 'ios' ? 'iOS' : os_name === 'ipados' ? 'iPadOS' : os_name)} ${os_version}, ${device_manufacturer} ${device_model}`}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[20%] text-center relative p-0">
                                            <Link
                                                href={traceHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className='truncate select-none'>{formatDateToHumanReadableDate(start_time)}</p>
                                                <div className='py-1' />
                                                <p className='text-xs truncate select-none'>{formatDateToHumanReadableTime(start_time)}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[10%] text-center truncate select-none relative p-0">
                                            <Link
                                                href={traceHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                {formatMillisToHumanReadable(duration)}
                                            </div>
                                        </TableCell>
                                        <TableCell className={`w-[10%] text-center truncate select-none relative p-0 ${status === 1 ? "text-green-600 dark:text-green-400" : status === 2 ? "text-red-600 dark:text-red-400" : ""}`}>
                                            <Link
                                                href={traceHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                {status === 0 ? 'Unset' : status === 1 ? 'Okay' : 'Error'}
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
