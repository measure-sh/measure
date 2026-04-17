"use client"
import { useFiltersStore } from '@/app/stores/provider'

import { FilterSource, emptySessionTimelinesOverviewResponse } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType } from '@/app/components/filters'
import LoadingBar from '@/app/components/loading_bar'
import Paginator from '@/app/components/paginator'
import SessionTimelinesOverviewPlot from '@/app/components/session_timelines_overview_plot'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { paginationOffsetUrlKey, useSessionTimelinesOverviewQuery } from '@/app/query/hooks'
import { underlineLinkStyle } from '@/app/utils/shared_styles'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime, formatMillisToHumanReadable } from '@/app/utils/time_utils'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const PAGINATION_LIMIT = 5

export default function SessionTimelinesOverview({ params }: { params: { teamId: string } }) {
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

    const { data: sessionTimelinesOverview = emptySessionTimelinesOverviewResponse, status, isFetching } = useSessionTimelinesOverviewQuery(paginationOffset)

    const nextPage = () => setPaginationOffset(o => o + PAGINATION_LIMIT)
    const prevPage = () => setPaginationOffset(o => Math.max(0, o - PAGINATION_LIMIT))

    return (
        <div className="flex flex-col items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Session Timelines</p>
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
                showSessionTypes={true}
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
                showFreeText={true}
                freeTextPlaceholder='Search User/Session ID, Logs, Event Type, Target View ID, File/Class name or Exception Traces...' />
            <div className="py-4" />

            {/* Error state for sessions fetch */}
            {filters.ready
                && status === 'error'
                && <p className="text-lg font-display">Error fetching list of sessions, please change filters, refresh page or select a different app to try again</p>}

            {/* Main sessions list UI */}
            {filters.ready
                && (status === 'success' || status === 'pending') &&
                <div className="flex flex-col items-center w-full">
                    <SessionTimelinesOverviewPlot />
                    <div className='self-end'>
                        <Paginator
                            prevEnabled={isFetching ? false : sessionTimelinesOverview.meta.previous}
                            nextEnabled={isFetching ? false : sessionTimelinesOverview.meta.next}
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
                        <TableHeader className="[&_tr]:!border-b-0 hover:bg-muted/50">
                            <TableRow className='hover:bg-transparent'>
                                <TableHead className="w-[60%]">Session Timeline</TableHead>
                                <TableHead className="w-[20%] text-center">Start Time</TableHead>
                                <TableHead className="w-[20%] text-center">Duration</TableHead>
                            </TableRow>
                            <TableRow className='hover:bg-transparent'>
                                <TableCell colSpan={3} className="p-0 border-b-1">
                                    <p className='px-4 pt-1 pb-4 text-xs font-body'>Note: Timelines are captured for Crashes, ANRs, Bug Reports & sampled sessions. <Link href="/docs/features/feature-session-timelines" className={underlineLinkStyle}>Learn more</Link> </p>
                                </TableCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sessionTimelinesOverview.results?.map(({ session_id, app_id, first_event_time, duration, matched_free_text, attribute }: any, idx: number) => {
                                const sessionHref = `/${params.teamId}/session_timelines/${app_id}/${session_id}`
                                return (
                                    <TableRow
                                        key={`${idx}-${session_id}`}
                                        className="font-body"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                router.push(sessionHref)
                                            }
                                        }}
                                    >
                                        <TableCell className="w-[60%] relative p-0">
                                            <Link
                                                href={sessionHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-label={`Session ID: ${session_id}`}
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className='truncate select-none'>Session ID: {session_id}</p>
                                                <div className='py-1' />
                                                <p className='text-xs truncate text-muted-foreground select-none'>{attribute.app_version + "(" + attribute.app_build + "), " + (attribute.os_name === 'android' ? 'Android API Level' : attribute.os_name === 'ios' ? 'iOS' : attribute.os_name === 'ipados' ? 'iPadOS' : attribute.os_name) + " " + attribute.os_version + ", " + attribute.device_manufacturer + " " + attribute.device_model}</p>
                                                {matched_free_text !== "" && <p className='p-1 mt-2 text-xs truncate border border-border bg-accent rounded-md '>{"Matched " + matched_free_text}</p>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[20%] text-center relative p-0">
                                            <Link
                                                href={sessionHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className='truncate select-none'>{formatDateToHumanReadableDate(first_event_time)}</p>
                                                <div className='py-1' />
                                                <p className='text-xs truncate select-none'>{formatDateToHumanReadableTime(first_event_time)}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[20%] text-center truncate select-none relative p-0">
                                            <Link
                                                href={sessionHref}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                {(duration as unknown as number) === 0 ? 'N/A' : formatMillisToHumanReadable(duration as unknown as number)}
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
