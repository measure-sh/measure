"use client"

import { emptySessionsOverviewResponse, fetchSessionsOverviewFromServer, FilterSource, SessionsOverviewApiStatus } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingBar from '@/app/components/loading_bar'
import Paginator from '@/app/components/paginator'
import SessionsOverviewPlot from '@/app/components/sessions_overview_plot'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime, formatMillisToHumanReadable } from '@/app/utils/time_utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PageState {
    sessionsOverviewApiStatus: SessionsOverviewApiStatus
    filters: typeof defaultFilters
    sessionsOverview: typeof emptySessionsOverviewResponse
    paginationOffset: number
}

const paginationLimit = 5
const paginationOffsetUrlKey = "po"

export default function SessionsOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const initialState: PageState = {
        sessionsOverviewApiStatus: SessionsOverviewApiStatus.Loading,
        filters: defaultFilters,
        sessionsOverview: emptySessionsOverviewResponse,
        paginationOffset: searchParams.get(paginationOffsetUrlKey) ? parseInt(searchParams.get(paginationOffsetUrlKey)!) : 0
    }

    const [pageState, setPageState] = useState<PageState>(initialState)


    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const getSessionsOverview = async () => {
        updatePageState({ sessionsOverviewApiStatus: SessionsOverviewApiStatus.Loading })

        const result = await fetchSessionsOverviewFromServer(pageState.filters, null, null, paginationLimit, pageState.paginationOffset)

        switch (result.status) {
            case SessionsOverviewApiStatus.Error:
                updatePageState({ sessionsOverviewApiStatus: SessionsOverviewApiStatus.Error })
                break
            case SessionsOverviewApiStatus.Success:
                updatePageState({
                    sessionsOverviewApiStatus: SessionsOverviewApiStatus.Success,
                    sessionsOverview: result.data
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

        getSessionsOverview()
    }, [pageState.paginationOffset, pageState.filters])

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Sessions</p>
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Events}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
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
                && pageState.sessionsOverviewApiStatus === SessionsOverviewApiStatus.Error
                && <p className="text-lg font-display">Error fetching list of sessions, please change filters, refresh page or select a different app to try again</p>}

            {/* Main sessions list UI */}
            {pageState.filters.ready
                && (pageState.sessionsOverviewApiStatus === SessionsOverviewApiStatus.Success || pageState.sessionsOverviewApiStatus === SessionsOverviewApiStatus.Loading) &&
                <div className="flex flex-col items-center w-full">
                    <SessionsOverviewPlot filters={pageState.filters} />
                    <div className='self-end'>
                        <Paginator
                            prevEnabled={pageState.sessionsOverviewApiStatus === SessionsOverviewApiStatus.Loading ? false : pageState.sessionsOverview.meta.previous}
                            nextEnabled={pageState.sessionsOverviewApiStatus === SessionsOverviewApiStatus.Loading ? false : pageState.sessionsOverview.meta.next}
                            displayText=''
                            onNext={handleNextPage}
                            onPrev={handlePrevPage}
                        />
                    </div>
                    <div className={`py-1 w-full ${pageState.sessionsOverviewApiStatus === SessionsOverviewApiStatus.Loading ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>
                    <div className="py-4" />
                    <Table className="font-display">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60%]">Session</TableHead>
                                <TableHead className="w-[20%] text-center">Start Time</TableHead>
                                <TableHead className="w-[20%] text-center">Duration</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pageState.sessionsOverview.results?.map(({ session_id, app_id, first_event_time, duration, matched_free_text, attribute }, idx) => {
                                const sessionHref = `/${params.teamId}/sessions/${app_id}/${session_id}`
                                return (
                                    <TableRow
                                        key={`${idx}-${session_id}`}
                                        className="font-body hover:bg-yellow-200 focus-visible:border-yellow-200 select-none"
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
                                                aria-label={`ID: ${session_id}`}
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className='truncate select-none'>ID: {session_id}</p>
                                                <div className='py-1' />
                                                <p className='text-xs truncate text-gray-500 select-none'>{attribute.app_version + "(" + attribute.app_build + "), " + attribute.os_name + " " + attribute.os_version + ", " + attribute.device_manufacturer + " " + attribute.device_model}</p>
                                                {matched_free_text !== "" && <p className='p-1 mt-2 text-xs truncate border border-black rounded-md '>{"Matched " + matched_free_text}</p>}
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