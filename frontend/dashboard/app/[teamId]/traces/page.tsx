"use client"

import { FilterSource, emptySpansResponse, SpansApiStatus, fetchSpansFromServer } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingBar from '@/app/components/loading_bar'
import Paginator from '@/app/components/paginator'
import SpanMetricsPlot from '@/app/components/span_metrics_plot'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime, formatMillisToHumanReadable } from '@/app/utils/time_utils'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'

interface PageState {
    spansApiStatus: SpansApiStatus
    filters: typeof defaultFilters
    spans: typeof emptySpansResponse
    paginationOffset: number
}

const paginationLimit = 5
const paginationOffsetUrlKey = "po"

export default function TracesOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const initialState: PageState = {
        spansApiStatus: SpansApiStatus.Loading,
        filters: defaultFilters,
        spans: emptySpansResponse,
        paginationOffset: searchParams.get(paginationOffsetUrlKey) ? parseInt(searchParams.get(paginationOffsetUrlKey)!) : 0
    }

    const [pageState, setPageState] = useState<PageState>(initialState)

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const getSpanInstances = async () => {
        updatePageState({ spansApiStatus: SpansApiStatus.Loading })

        const result = await fetchSpansFromServer(pageState.filters, paginationLimit, pageState.paginationOffset)

        switch (result.status) {
            case SpansApiStatus.Error:
                updatePageState({ spansApiStatus: SpansApiStatus.Error })
                break
            case SpansApiStatus.Success:
                updatePageState({
                    spansApiStatus: SpansApiStatus.Success,
                    spans: result.data
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

        getSpanInstances()
    }, [pageState.paginationOffset, pageState.filters])

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
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
                onFiltersChanged={handleFiltersChanged} />
            <div className="py-4" />

            {/* Error state for sessions fetch */}
            {pageState.filters.ready
                && pageState.spansApiStatus === SpansApiStatus.Error
                && <p className="text-lg font-display">Error fetching list of traces, please change filters, refresh page or select a different app to try again</p>}

            {/* Main root spans list UI */}
            {pageState.filters.ready
                && (pageState.spansApiStatus === SpansApiStatus.Success || pageState.spansApiStatus === SpansApiStatus.Loading) &&
                <div className="flex flex-col items-center w-full">
                    <SpanMetricsPlot
                        filters={pageState.filters} />
                    <div className='self-end'>
                        <Paginator
                            prevEnabled={pageState.spansApiStatus === SpansApiStatus.Loading ? false : pageState.spans.meta.previous}
                            nextEnabled={pageState.spansApiStatus === SpansApiStatus.Loading ? false : pageState.spans.meta.next}
                            displayText=''
                            onNext={handleNextPage}
                            onPrev={handlePrevPage}
                        />
                    </div>

                    <div className={`py-1 w-full ${pageState.spansApiStatus === SpansApiStatus.Loading ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>
                    <div className='py-4' />
                    <Table className="font-display">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60%]">Trace</TableHead>
                                <TableHead className="w-[20%] text-center">Start Time</TableHead>
                                <TableHead className="w-[10%] text-center">Duration</TableHead>
                                <TableHead className="w-[10%] text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="font-body">
                            {pageState.spans.results?.map(({ app_id, span_name, span_id, trace_id, status, start_time, duration, app_version, app_build, os_name, os_version, device_manufacturer, device_model }, idx) => (
                                <TableRow
                                    key={`${idx}-${span_id}`}
                                    className="font-body hover:bg-yellow-200 focus-visible:border-yellow-200 cursor-pointer"
                                    tabIndex={0}
                                    role="button"
                                    onClick={() => router.push(`/${params.teamId}/traces/${app_id}/${trace_id}`)}
                                    onKeyDown={(e: React.KeyboardEvent<HTMLTableRowElement>) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            router.push(`/${params.teamId}/traces/${app_id}/${trace_id}`)
                                        }
                                    }}
                                >
                                    <TableCell className="w-[60%]">
                                        <p className='text-xs truncate text-gray-500'>ID: {trace_id}</p>
                                        <div className='py-1' />
                                        <p className='truncate'>{span_name}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate text-gray-500'>{`v${app_version}(${app_build}), ${os_name} ${os_version}, ${device_manufacturer} ${device_model}`}</p>
                                    </TableCell>
                                    <TableCell className="w-[20%] text-center">
                                        <p className='truncate'>{formatDateToHumanReadableDate(start_time)}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate'>{formatDateToHumanReadableTime(start_time)}</p>
                                    </TableCell>
                                    <TableCell className="w-[10%] text-center truncate">{formatMillisToHumanReadable(duration)}</TableCell>
                                    <TableCell className={`w-[10%] text-center truncate ${status === 1 ? "text-green-600" : status === 2 ? "text-red-600" : ""}`}>{status === 0 ? 'Unset' : status === 1 ? 'Okay' : 'Error'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>}
        </div>
    )
}