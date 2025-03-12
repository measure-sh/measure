"use client"

import { FilterSource, emptySpansResponse, SpansApiStatus, fetchSpansFromServer } from '@/app/api/api_calls';
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters';
import LoadingBar from '@/app/components/loading_bar';
import Paginator from '@/app/components/paginator';
import SpanMetricsPlot from '@/app/components/span_metrics_plot';
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime, formatMillisToHumanReadable } from '@/app/utils/time_utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

export default function TracesOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()

    const [filters, setFilters] = useState(defaultFilters);

    const [spans, setSpans] = useState(emptySpansResponse);
    const [spansApiStatus, setSpansApiStatus] = useState(SpansApiStatus.Loading)
    const paginationLimit = 5
    const [paginationOffset, setPaginationOffset] = useState(0)

    const getSpanInstances = async () => {
        setSpansApiStatus(SpansApiStatus.Loading)

        const result = await fetchSpansFromServer(filters, paginationLimit, paginationOffset, router)

        switch (result.status) {
            case SpansApiStatus.Error:
                setSpansApiStatus(SpansApiStatus.Error)
                break
            case SpansApiStatus.Success:
                setSpansApiStatus(SpansApiStatus.Success)
                setSpans(result.data)
                break
        }
    }

    useEffect(() => {
        if (!filters.ready) {
            return
        }

        getSpanInstances()
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
            <p className="font-display text-4xl max-w-6xl text-center">Traces</p>
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Spans}
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
                showBugReportStatus={false}
                showUdAttrs={true}
                showFreeText={false}
                onFiltersChanged={(updatedFilters) => setFilters(updatedFilters)} />
            <div className="py-4" />

            {/* Error state for sessions fetch */}
            {filters.ready
                && spansApiStatus === SpansApiStatus.Error
                && <p className="text-lg font-display">Error fetching list of traces, please change filters, refresh page or select a different app to try again</p>}

            {/* Main root spans list UI */}
            {filters.ready
                && (spansApiStatus === SpansApiStatus.Success || spansApiStatus === SpansApiStatus.Loading) &&
                <div className="flex flex-col items-center w-full">
                    <div className="py-4" />
                    <SpanMetricsPlot
                        filters={filters} />
                    <div className="py-4" />
                    <div className='self-end'>
                        <Paginator prevEnabled={spansApiStatus === SpansApiStatus.Loading ? false : spans.meta.previous} nextEnabled={spansApiStatus === SpansApiStatus.Loading ? false : spans.meta.next} displayText=''
                            onNext={() => {
                                setPaginationOffset(paginationOffset + paginationLimit)
                            }}
                            onPrev={() => {
                                setPaginationOffset(paginationOffset - paginationLimit)
                            }} />
                    </div>
                    <div className={`py-1 w-full ${spansApiStatus === SpansApiStatus.Loading ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>
                    <div className="table border border-black rounded-md w-full" style={{ tableLayout: "fixed" }}>
                        <div className="table-header-group bg-neutral-950">
                            <div className="table-row text-white font-display">
                                <div className="table-cell w-96 p-4">Trace</div>
                                <div className="table-cell w-48 p-4 text-center">Start Time</div>
                                <div className="table-cell w-48 p-4 text-center">Duration</div>
                                <div className="table-cell w-48 p-4 text-center">Status</div>
                            </div>
                        </div>
                        <div className="table-row-group font-body">
                            {spans.results?.map(({ app_id, span_name, span_id, trace_id, status, start_time, duration, app_version, app_build, os_name, os_version, device_manufacturer, device_model }, idx) => (
                                <Link key={`${idx}-${span_id}`} href={`/${params.teamId}/traces/${app_id}/${trace_id}`} className="table-row border-b-2 border-black hover:bg-yellow-200 focus:bg-yellow-200 active:bg-yellow-300 ">
                                    <div className="table-cell p-4">
                                        <p className='truncate'>{span_name}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate'>Trace ID: {trace_id}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate text-gray-500'>{"v" + app_version + "(" + app_build + "), " + os_name + " " + os_version + ", " + device_manufacturer + " " + device_model}</p>
                                    </div>
                                    <div className="table-cell p-4 text-center">
                                        <p className='truncate'>{formatDateToHumanReadableDate(start_time)}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate'>{formatDateToHumanReadableTime(start_time)}</p>
                                    </div>
                                    <div className="table-cell p-4 text-center truncate">{formatMillisToHumanReadable(duration)}</div>
                                    <div className={`table-cell p-4 text-center truncate ${status === 1 ? "text-green-600" : status === 2 ? "text-red-600" : ""}`}>{status === 0 ? 'Unset' : status === 1 ? 'Okay' : 'Error'}</div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>}
        </div>
    )
}

