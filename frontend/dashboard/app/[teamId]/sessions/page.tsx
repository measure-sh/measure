"use client"

import { emptySessionsOverviewResponse, SessionsOverviewApiStatus, fetchSessionsOverviewFromServer, FiltersApiType } from '@/app/api/api_calls';
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters';
import LoadingBar from '@/app/components/loading_bar';
import Paginator from '@/app/components/paginator';
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
    const paginationLimit = 5
    const [paginationOffset, setPaginationOffset] = useState(0)

    const getSessionsOverview = async () => {
        setSessionsOverviewApiStatus(SessionsOverviewApiStatus.Loading)

        const result = await fetchSessionsOverviewFromServer(filters, null, null, paginationLimit, paginationOffset, router)

        switch (result.status) {
            case SessionsOverviewApiStatus.Error:
                setSessionsOverviewApiStatus(SessionsOverviewApiStatus.Error)
                break
            case SessionsOverviewApiStatus.Success:
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
    }, [paginationOffset, filters]);

    useEffect(() => {
        if (!filters.ready) {
            return
        }
        setPaginationOffset(0)
    }, [filters])

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
            <div className="py-4" />
            <p className="font-display text-4xl max-w-6xl text-center">Sessions</p>
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
                showBugReportStatus={false}
                showUdAttrs={true}
                showFreeText={true}
                freeTextPlaceholder='Search User/Session ID, Logs, Event Type, Target View ID, File/Class name or Exception Traces...'
                onFiltersChanged={(updatedFilters) => setFilters(updatedFilters)} />
            <div className="py-4" />

            {/* Error state for sessions fetch */}
            {filters.ready
                && sessionsOverviewApiStatus === SessionsOverviewApiStatus.Error
                && <p className="text-lg font-display">Error fetching list of sessions, please change filters, refresh page or select a different app to try again</p>}

            {/* Main sessions list UI */}
            {filters.ready
                && (sessionsOverviewApiStatus === SessionsOverviewApiStatus.Success || sessionsOverviewApiStatus === SessionsOverviewApiStatus.Loading) &&
                <div className="flex flex-col items-center w-full">
                    <div className="py-4" />
                    <SessionsOverviewPlot
                        filters={filters} />
                    <div className="py-4" />
                    <div className='self-end'>
                        <Paginator prevEnabled={sessionsOverviewApiStatus === SessionsOverviewApiStatus.Loading ? false : sessionsOverview.meta.previous} nextEnabled={sessionsOverviewApiStatus === SessionsOverviewApiStatus.Loading ? false : sessionsOverview.meta.next} displayText=''
                            onNext={() => {
                                setPaginationOffset(paginationOffset + paginationLimit)
                            }}
                            onPrev={() => {
                                setPaginationOffset(paginationOffset - paginationLimit)
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
                        <div className="table-row-group font-body">
                            {sessionsOverview.results?.map(({ session_id, app_id, first_event_time, duration, matched_free_text, attribute }, idx) => (
                                <Link key={`${idx}-${session_id}`} href={`/${params.teamId}/sessions/${app_id}/${session_id}`} className="table-row border-b-2 border-black hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300 ">
                                    <div className="table-cell p-4">
                                        <p className='truncate'>{session_id}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate text-gray-500'>{"v" + attribute.app_version + "(" + attribute.app_build + "), " + attribute.os_name + " " + attribute.os_version + ", " + attribute.device_manufacturer + " " + attribute.device_model}</p>
                                        {matched_free_text !== "" && <p className='p-1 mt-2 text-xs truncate border border-black rounded-md '>{"Matched " + matched_free_text}</p>}
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

