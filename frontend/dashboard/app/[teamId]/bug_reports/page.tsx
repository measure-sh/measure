"use client"

import { BugReportsOverviewApiStatus, emptyBugReportsOverviewResponse, fetchBugReportsOverviewFromServer, FilterSource } from '@/app/api/api_calls'
import BugReportsOverviewPlot from '@/app/components/bug_reports_overview_plot'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingBar from '@/app/components/loading_bar'
import Paginator from '@/app/components/paginator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'

import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from '@/app/utils/time_utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PageState {
    bugReportsOverviewApiStatus: BugReportsOverviewApiStatus
    filters: typeof defaultFilters
    bugReportsOverview: typeof emptyBugReportsOverviewResponse
    paginationOffset: number
}

const paginationLimit = 5
const paginationOffsetUrlKey = "po"

export default function BugReportsOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const initialState: PageState = {
        bugReportsOverviewApiStatus: BugReportsOverviewApiStatus.Loading,
        filters: defaultFilters,
        bugReportsOverview: emptyBugReportsOverviewResponse,
        paginationOffset: searchParams.get(paginationOffsetUrlKey) ? parseInt(searchParams.get(paginationOffsetUrlKey)!) : 0
    }

    const [pageState, setPageState] = useState<PageState>(initialState)

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const getBugReportsOverview = async () => {
        updatePageState({ bugReportsOverviewApiStatus: BugReportsOverviewApiStatus.Loading })

        const result = await fetchBugReportsOverviewFromServer(pageState.filters, paginationLimit, pageState.paginationOffset)

        switch (result.status) {
            case BugReportsOverviewApiStatus.Error:
                updatePageState({ bugReportsOverviewApiStatus: BugReportsOverviewApiStatus.Error })
                break
            case BugReportsOverviewApiStatus.Success:
                updatePageState({
                    bugReportsOverviewApiStatus: BugReportsOverviewApiStatus.Success,
                    bugReportsOverview: result.data
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

        getBugReportsOverview()
    }, [pageState.paginationOffset, pageState.filters])

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
                showSessionType={false}
                showOsVersions={true}
                showCountries={true}
                showNetworkTypes={true}
                showNetworkProviders={true}
                showNetworkGenerations={true}
                showLocales={true}
                showDeviceManufacturers={true}
                showDeviceNames={true}
                showBugReportStatus={true}
                showUdAttrs={true}
                showFreeText={true}
                freeTextPlaceholder='Search User ID, Session Id, Bug Report ID or description..'
                onFiltersChanged={handleFiltersChanged} />
            <div className="py-4" />

            {/* Error state for bug reports fetch */}
            {pageState.filters.ready
                && pageState.bugReportsOverviewApiStatus === BugReportsOverviewApiStatus.Error
                && <p className="text-lg font-display">Error fetching list of bug reports, please change filters, refresh page or select a different app to try again</p>}

            {/* Main bug reports list UI */}
            {pageState.filters.ready
                && (pageState.bugReportsOverviewApiStatus === BugReportsOverviewApiStatus.Success || pageState.bugReportsOverviewApiStatus === BugReportsOverviewApiStatus.Loading) &&
                <div className="flex flex-col items-center w-full">
                    <BugReportsOverviewPlot
                        filters={pageState.filters} />
                    <div className='self-end'>
                        <Paginator
                            prevEnabled={pageState.bugReportsOverviewApiStatus === BugReportsOverviewApiStatus.Loading ? false : pageState.bugReportsOverview.meta.previous}
                            nextEnabled={pageState.bugReportsOverviewApiStatus === BugReportsOverviewApiStatus.Loading ? false : pageState.bugReportsOverview.meta.next}
                            displayText=''
                            onNext={handleNextPage}
                            onPrev={handlePrevPage}
                        />
                    </div>
                    <div className={`py-1 w-full ${pageState.bugReportsOverviewApiStatus === BugReportsOverviewApiStatus.Loading ? 'visible' : 'invisible'}`}>
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
                            {pageState.bugReportsOverview.results?.map(({ event_id, description, status, app_id, timestamp, matched_free_text, attribute }, idx) => {
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
                                            <a
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
                                            <a
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
                                            <a
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