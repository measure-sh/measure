"use client"

import { emptyBugReportsOverviewResponse, BugReportsOverviewApiStatus, fetchBugReportsOverviewFromServer, FilterSource } from '@/app/api/api_calls';
import BugReportsOverviewPlot from '@/app/components/bug_reports_overview_plot';
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters';
import LoadingBar from '@/app/components/loading_bar';
import Paginator from '@/app/components/paginator';

import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from '@/app/utils/time_utils';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';

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

        const result = await fetchBugReportsOverviewFromServer(pageState.filters, paginationLimit, pageState.paginationOffset, router)

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
        if (updatedFilters.ready && pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
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
        <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
            <div className="py-4" />
            <p className="font-display text-4xl max-w-6xl text-center">Bug Reports</p>
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Events}
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
                showBugReportStatus={true}
                showUdAttrs={true}
                showFreeText={true}
                freeTextPlaceholder='Search Search User ID, Session Id, Bug Report ID or description..'
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
                    <div className="py-4" />
                    <BugReportsOverviewPlot
                        filters={pageState.filters} />
                    <div className="py-4" />
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
                    <div className="table border border-black rounded-md w-full" style={{ tableLayout: "fixed" }}>
                        <div className="table-header-group bg-neutral-950">
                            <div className="table-row text-white font-display">
                                <div className="table-cell w-96 p-4">Bug Report Id</div>
                                <div className="table-cell w-48 p-4 text-center">Time</div>
                                <div className="table-cell w-48 p-4 text-center">Status</div>
                            </div>
                        </div>
                        <div className="table-row-group font-body">
                            {pageState.bugReportsOverview.results?.map(({ event_id, description, status, app_id, timestamp, matched_free_text, attribute }, idx) => (
                                <Link key={`${idx}-${event_id}`} href={`/${params.teamId}/bug_reports/${app_id}/${event_id}`} className="table-row border-b-2 border-black hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300 ">
                                    <div className="table-cell p-4">
                                        <p className="truncate text-xs text-gray-500">{event_id}</p>
                                        <div className='py-1' />
                                        <p className='truncate'>{description ? description : "No Description"}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate text-gray-500'>{"v" + attribute.app_version + "(" + attribute.app_build + "), " + attribute.os_name + " " + attribute.os_version + ", " + attribute.device_manufacturer + " " + attribute.device_model}</p>
                                        {matched_free_text !== "" && <p className='p-1 mt-2 text-xs truncate border border-black rounded-md '>{"Matched " + matched_free_text}</p>}
                                    </div>
                                    <div className="table-cell p-4 text-center">
                                        <p className='truncate'>{formatDateToHumanReadableDate(timestamp)}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate'>{formatDateToHumanReadableTime(timestamp)}</p>
                                    </div>
                                    <div className="table-cell p-4 text-center">
                                        <div className='items-center flex justify-center'>
                                            <p className={`w-20 px-2 py-1 rounded-full border text-sm font-body ${status === 0 ? 'border-green-600 text-green-600 bg-green-50' : 'border-indigo-600 text-indigo-600 bg-indigo-50'}`}>{status === 0 ? 'Open' : 'Closed'}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>}
        </div>
    )
}