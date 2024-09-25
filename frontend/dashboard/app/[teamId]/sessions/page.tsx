"use client"

import { emptySessionsOverviewResponse, SessionsOverviewApiStatus, fetchSessionsOverviewFromServer, FiltersApiType } from '@/app/api/api_calls';
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters';
import Paginator, { PaginationDirection } from '@/app/components/paginator';
import SessionsOverviewPlot from '@/app/components/sessions_overview_plot';
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime, formatMillisToHumanReadable } from '@/app/utils/time_utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

export default function SessionsOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const [sessionsOverviewApiStatus, setSessionsOverviewApiStatus] = useState(SessionsOverviewApiStatus.Loading);

    const [filters, setFilters] = useState(defaultFilters);

    const [sessionsOverview, setSessionsOverview] = useState(emptySessionsOverviewResponse);
    const paginationOffset = 5
    const [paginationRange, setPaginationRange] = useState({ start: 1, end: paginationOffset })
    const [paginationDirection, setPaginationDirection] = useState(PaginationDirection.None)

    const getSessionsOverview = async () => {
        setSessionsOverviewApiStatus(SessionsOverviewApiStatus.Loading)

        // Set key id if user has paginated. Last index of current list if forward navigation, first index if backward
        var keyId = null
        if (sessionsOverview.results !== null && sessionsOverview.results.length > 0) {
            if (paginationDirection === PaginationDirection.Forward) {
                keyId = sessionsOverview.results[sessionsOverview.results.length - 1].session_id
            } else if (paginationDirection === PaginationDirection.Backward) {
                keyId = sessionsOverview.results[0].session_id
            }
        }

        // Invert limit if paginating backward
        var limit = paginationOffset
        if (paginationDirection === PaginationDirection.Backward) {
            limit = - limit
        }

        const result = await fetchSessionsOverviewFromServer(filters, keyId, limit, router)

        switch (result.status) {
            case SessionsOverviewApiStatus.Error:
                setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
                setSessionsOverviewApiStatus(SessionsOverviewApiStatus.Error)
                break
            case SessionsOverviewApiStatus.Success:
                setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
                setSessionsOverviewApiStatus(SessionsOverviewApiStatus.Success)
                setSessionsOverview(result.data)
                break
        }
    }

    useEffect(() => {
        if (!filters.ready) {
            return
        }

        getSessionsOverview()
    }, [paginationRange, filters]);

    // Reset pagination range if not in default if any filters change
    useEffect(() => {
        // If we reset pagination range even if values haven't changed, we will trigger
        // an unnecessary getSessionsOverview effect
        if (paginationRange.start === 1 && paginationRange.end === paginationOffset) {
            return
        }

        setPaginationRange({ start: 1, end: paginationOffset })
    }, [filters]);

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
            <div className="py-4" />
            <p className="font-display font-regular text-4xl max-w-6xl text-center">Sessions</p>
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filtersApiType={FiltersApiType.All}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
                showCreateApp={true}
                showNoData={true}
                showNotOnboarded={true}
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
                showFreeText={true}
                onFiltersChanged={(updatedFilters) => setFilters(updatedFilters)} />
            <div className="py-4" />

            {/* Error state for sessions fetch */}
            {filters.ready
                && sessionsOverviewApiStatus === SessionsOverviewApiStatus.Error
                && <p className="text-lg font-display">Error fetching list of sessions, please change filters, refresh page or select a different app to try again</p>}

            {/* Empty state for sessions fetch */}
            {filters.ready
                && sessionsOverviewApiStatus === SessionsOverviewApiStatus.Success
                && (sessionsOverview.results === null || sessionsOverview.results.length === 0)
                && <p className="text-lg font-display">It seems there are no sessions for the current combination of filters. Please change filters to try again</p>}

            {/* Main sessions list UI */}
            {filters.ready
                && (sessionsOverviewApiStatus === SessionsOverviewApiStatus.Success || sessionsOverviewApiStatus === SessionsOverviewApiStatus.Loading)
                && sessionsOverview.results !== null
                && sessionsOverview.results.length > 0 &&
                <div className="flex flex-col items-center w-full">
                    <div className="py-4" />
                    <SessionsOverviewPlot
                        filters={filters} />
                    <div className="py-4" />
                    <div className='self-end'>
                        <Paginator prevEnabled={sessionsOverview.meta.previous} nextEnabled={sessionsOverview.meta.next} displayText={paginationRange.start + ' - ' + paginationRange.end}
                            onNext={() => {
                                setPaginationRange({ start: paginationRange.start + paginationOffset, end: paginationRange.end + paginationOffset })
                                setPaginationDirection(PaginationDirection.Forward)
                            }}
                            onPrev={() => {
                                setPaginationRange({ start: paginationRange.start - paginationOffset, end: paginationRange.end - paginationOffset })
                                setPaginationDirection(PaginationDirection.Backward)
                            }} />
                    </div>
                    <div className="py-1" />
                    <div className="table border border-black rounded-md w-full" style={{ tableLayout: "fixed" }}>
                        <div className="table-header-group bg-neutral-950">
                            <div className="table-row text-white font-display">
                                <div className="table-cell w-96 p-4">Session Id</div>
                                <div className="table-cell w-48 p-4 text-center">Start Time</div>
                                <div className="table-cell w-48 p-4 text-center">Duration</div>
                            </div>
                        </div>
                        <div className="table-row-group font-sans">
                            {sessionsOverview.results.map(({ session_id, app_id, first_event_time, duration, matched_free_text, attribute }) => (
                                <Link key={session_id} href={`/${params.teamId}/sessions/${app_id}/${session_id}`} className="table-row border-b-2 border-black hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300 ">
                                    <div className="table-cell p-4">
                                        <p className='truncate'>{session_id}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate text-gray-500'>{"v" + attribute.app_version + "(" + attribute.app_build + "), " + attribute.os_name + " " + attribute.os_version + ", " + attribute.device_manufacturer + " " + attribute.device_model}</p>
                                        {matched_free_text !== "" && <p className='p-1 mt-2 w-fit text-xs truncate border border-black rounded-md '>{"Matched " + matched_free_text}</p>}
                                    </div>
                                    <div className="table-cell p-4 text-center">
                                        <p className='truncate'>{formatDateToHumanReadableDate(first_event_time)}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate'>{formatDateToHumanReadableTime(first_event_time)}</p>
                                    </div>
                                    <div className="table-cell p-4 text-center truncate">{(duration as unknown as number) === 0 ? 'N/A' : formatMillisToHumanReadable(duration as unknown as number)}</div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>}
        </div>
    )
}

