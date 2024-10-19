"use client"

import { emptySessionsOverviewResponse, SessionsOverviewApiStatus, fetchSessionsOverviewFromServer, FiltersApiType } from '@/app/api/api_calls';
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters';
import LoadingBar from '@/app/components/loading_bar';
import Paginator, { PaginationDirection } from '@/app/components/paginator';
import SessionsOverviewPlot from '@/app/components/sessions_overview_plot';
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime, formatMillisToHumanReadable } from '@/app/utils/time_utils';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';

export default function SessionsOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [sessionsOverviewApiStatus, setSessionsOverviewApiStatus] = useState(SessionsOverviewApiStatus.Loading);

    const [filters, setFilters] = useState(defaultFilters);

    const [sessionsOverview, setSessionsOverview] = useState(emptySessionsOverviewResponse);
    const paginationOffset = 5

    const getDefaultPaginatorStart = () => {
        let start = searchParams.get('paginatorStart')
        if (start) {
            return parseInt(start)
        } else {
            return 1
        }
    }

    const getDefaultPaginatorEnd = () => {
        let end = searchParams.get('paginatorEnd')
        if (end) {
            return parseInt(end)
        } else {
            return paginationOffset
        }
    }

    const [paginationRange, setPaginationRange] = useState({ start: getDefaultPaginatorStart(), end: getDefaultPaginatorEnd() })
    const [paginationDirection, setPaginationDirection] = useState(PaginationDirection.None)

    const getKeyId = () => {
        var keyId = searchParams.get('keyId')
        if (sessionsOverview.results !== null && sessionsOverview.results.length > 0) {
            if (paginationDirection === PaginationDirection.Forward) {
                keyId = sessionsOverview.results[sessionsOverview.results.length - 1].session_id
            } else if (paginationDirection === PaginationDirection.Backward) {
                keyId = sessionsOverview.results[0].session_id
            }
        }
        return keyId
    }

    const getLimit = () => {
        // Invert limit if paginating backward
        var limit = paginationOffset
        if (paginationDirection === PaginationDirection.Backward) {
            limit = - limit
        }
        return limit
    }

    const updateUrlWithPaginatorData = () => {
        const params = new URLSearchParams(searchParams.toString());

        const keyId = getKeyId()

        if (!keyId) {
            return
        }

        params.set('keyId', keyId)
        params.set('paginatorStart', paginationRange.start.toString())
        params.set('paginatorEnd', paginationRange.end.toString())

        router.replace(`?${params.toString()}`, { scroll: false });
    }

    const clearUrlPaginatorData = () => {
        const params = new URLSearchParams(searchParams.toString());

        params.delete('keyId')
        params.delete('paginatorStart')
        params.delete('paginatorEnd')

        router.replace(`?${params.toString()}`, { scroll: false });
    }

    const getSessionsOverview = async () => {
        setSessionsOverviewApiStatus(SessionsOverviewApiStatus.Loading)

        const keyId = getKeyId()
        const limit = getLimit()

        const result = await fetchSessionsOverviewFromServer(filters, keyId, limit, router)

        switch (result.status) {
            case SessionsOverviewApiStatus.Error:
                setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
                setSessionsOverviewApiStatus(SessionsOverviewApiStatus.Error)
                clearUrlPaginatorData()
                break
            case SessionsOverviewApiStatus.Success:
                setPaginationDirection(PaginationDirection.None) // Reset pagination direction to None after API call so that a change in any filters does not cause keyId to be added to the next API call
                setSessionsOverviewApiStatus(SessionsOverviewApiStatus.Success)
                setSessionsOverview(result.data)
                updateUrlWithPaginatorData()
                break
        }
    }

    useEffect(() => {
        if (!filters.ready) {
            return
        }

        getSessionsOverview()
    }, [paginationRange, filters]);

    // Reset pagination range on filters change
    useEffect(() => {
        // If we reset pagination range even if values haven't changed, we will trigger
        // an unnecessary getSessionsOverview effect
        if (paginationRange.start === getDefaultPaginatorStart()
            && paginationRange.end === getDefaultPaginatorEnd()) {
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
                showFreeText={true}
                onFiltersChanged={(updatedFilters) => setFilters(updatedFilters)} />
            <div className="py-4" />

            {/* Error state for sessions fetch */}
            {filters.ready
                && sessionsOverviewApiStatus === SessionsOverviewApiStatus.Error
                && <p className="text-lg font-display">Error fetching list of sessions, please change filters, refresh page or select a different app to try again</p>}

            {/* Main sessions list UI */}
            {filters.ready
                && (sessionsOverviewApiStatus === SessionsOverviewApiStatus.Success || sessionsOverviewApiStatus === SessionsOverviewApiStatus.Loading)
                && sessionsOverview.results !== null &&
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
                    <div className={`py-1 w-full ${sessionsOverviewApiStatus === SessionsOverviewApiStatus.Loading ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>
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

