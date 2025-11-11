"use client"

import { emptySessionTimelinesOverviewResponse, fetchSessionTimelinesOverviewFromServer, FilterSource, SessionTimelinesOverviewApiStatus } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingBar from '@/app/components/loading_bar'
import Paginator from '@/app/components/paginator'
import SessionTimelinesOverviewPlot from '@/app/components/session_timelines_overview_plot'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { underlineLinkStyle } from '@/app/utils/shared_styles'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime, formatMillisToHumanReadable } from '@/app/utils/time_utils'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PageState {
    sessionTimelinesOverviewApiStatus: SessionTimelinesOverviewApiStatus
    filters: typeof defaultFilters
    sessionTimelinesOverview: typeof emptySessionTimelinesOverviewResponse
    paginationOffset: number
}

const paginationLimit = 5
const paginationOffsetUrlKey = "po"

export default function SessionTimelinesOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const initialState: PageState = {
        sessionTimelinesOverviewApiStatus: SessionTimelinesOverviewApiStatus.Loading,
        filters: defaultFilters,
        sessionTimelinesOverview: emptySessionTimelinesOverviewResponse,
        paginationOffset: searchParams.get(paginationOffsetUrlKey) ? parseInt(searchParams.get(paginationOffsetUrlKey)!) : 0
    }

    const [pageState, setPageState] = useState<PageState>(initialState)


    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const getSessionTimelinesOverview = async () => {
        updatePageState({ sessionTimelinesOverviewApiStatus: SessionTimelinesOverviewApiStatus.Loading })

        const result = await fetchSessionTimelinesOverviewFromServer(pageState.filters, null, null, paginationLimit, pageState.paginationOffset)

        switch (result.status) {
            case SessionTimelinesOverviewApiStatus.Error:
                updatePageState({ sessionTimelinesOverviewApiStatus: SessionTimelinesOverviewApiStatus.Error })
                break
            case SessionTimelinesOverviewApiStatus.Success:
                updatePageState({
                    sessionTimelinesOverviewApiStatus: SessionTimelinesOverviewApiStatus.Success,
                    sessionTimelinesOverview: result.data
                })
                break
        }
    }

    const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
        // update filters only if they have changed
        if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
            updatePageState({
                filters: updatedFilters,
                // Reset pagination on filters change if previous filters were not default filters
                paginationOffset: pageState.filters.serialisedFilters && searchParams.get(paginationOffsetUrlKey) ? 0 : pageState.paginationOffset
            })
        }
    }

    const handleNextPage = () => {
        updatePageState({ paginationOffset: pageState.paginationOffset + paginationLimit })
    }

    const handlePrevPage = () => {
        updatePageState({ paginationOffset: Math.max(0, pageState.paginationOffset - paginationLimit) })
    }

    useEffect(() => {
        if (!pageState.filters.ready) {
            return
        }

        // update url
        router.replace(`?${paginationOffsetUrlKey}=${encodeURIComponent(pageState.paginationOffset)}&${pageState.filters.serialisedFilters!}`, { scroll: false })

        getSessionTimelinesOverview()
    }, [pageState.paginationOffset, pageState.filters])

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
                showSessionType={true}
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
                showFreeText={true}
                freeTextPlaceholder='Search User/Session ID, Logs, Event Type, Target View ID, File/Class name or Exception Traces...'
                onFiltersChanged={handleFiltersChanged} />
            <div className="py-4" />

            {/* Error state for sessions fetch */}
            {pageState.filters.ready
                && pageState.sessionTimelinesOverviewApiStatus === SessionTimelinesOverviewApiStatus.Error
                && <p className="text-lg font-display">Error fetching list of sessions, please change filters, refresh page or select a different app to try again</p>}

            {/* Main sessions list UI */}
            {pageState.filters.ready
                && (pageState.sessionTimelinesOverviewApiStatus === SessionTimelinesOverviewApiStatus.Success || pageState.sessionTimelinesOverviewApiStatus === SessionTimelinesOverviewApiStatus.Loading) &&
                <div className="flex flex-col items-center w-full">
                    <SessionTimelinesOverviewPlot filters={pageState.filters} />
                    <div className='self-end'>
                        <Paginator
                            prevEnabled={pageState.sessionTimelinesOverviewApiStatus === SessionTimelinesOverviewApiStatus.Loading ? false : pageState.sessionTimelinesOverview.meta.previous}
                            nextEnabled={pageState.sessionTimelinesOverviewApiStatus === SessionTimelinesOverviewApiStatus.Loading ? false : pageState.sessionTimelinesOverview.meta.next}
                            displayText=''
                            onNext={handleNextPage}
                            onPrev={handlePrevPage}
                        />
                    </div>
                    <div className={`py-1 w-full ${pageState.sessionTimelinesOverviewApiStatus === SessionTimelinesOverviewApiStatus.Loading ? 'visible' : 'invisible'}`}>
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
                                    <p className='px-4 pt-1 pb-4 text-xs font-body'>Note: Timelines are captured for Crashes, ANRs, Bug Reports & sampled sessions. <Link href="https://github.com/measure-sh/measure/blob/main/docs/features/feature-session-timelines.md" target="_blank" className={underlineLinkStyle}>Learn more</Link> </p>
                                </TableCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pageState.sessionTimelinesOverview.results?.map(({ session_id, app_id, first_event_time, duration, matched_free_text, attribute }, idx) => {
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
                                            <a
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
                                            <a
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
                                            <a
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