"use client"

import { AlertsOverviewApiStatus, emptyAlertsOverviewResponse, fetchAlertsOverviewFromServer, FilterSource } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingBar from '@/app/components/loading_bar'
import Paginator from '@/app/components/paginator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'

import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from '@/app/utils/time_utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PageState {
    alertsOverviewApiStatus: AlertsOverviewApiStatus
    filters: typeof defaultFilters
    alertsOverview: typeof emptyAlertsOverviewResponse
    paginationOffset: number
}

const paginationLimit = 5
const paginationOffsetUrlKey = "po"

export default function AlertsOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const initialState: PageState = {
        alertsOverviewApiStatus: AlertsOverviewApiStatus.Loading,
        filters: defaultFilters,
        alertsOverview: emptyAlertsOverviewResponse,
        paginationOffset: searchParams.get(paginationOffsetUrlKey) ? parseInt(searchParams.get(paginationOffsetUrlKey)!) : 0
    }

    const [pageState, setPageState] = useState<PageState>(initialState)

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const getAlertsOverview = async () => {
        updatePageState({ alertsOverviewApiStatus: AlertsOverviewApiStatus.Loading })

        const result = await fetchAlertsOverviewFromServer(pageState.filters, paginationLimit, pageState.paginationOffset)

        switch (result.status) {
            case AlertsOverviewApiStatus.Error:
                updatePageState({ alertsOverviewApiStatus: AlertsOverviewApiStatus.Error })
                break
            case AlertsOverviewApiStatus.Success:
                updatePageState({
                    alertsOverviewApiStatus: AlertsOverviewApiStatus.Success,
                    alertsOverview: result.data
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

        getAlertsOverview()
    }, [pageState.paginationOffset, pageState.filters])

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Alerts</p>
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Events}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
                showNoData={true}
                showNotOnboarded={true}
                showAppSelector={true}
                showAppVersions={false}
                showDates={true}
                showSessionType={false}
                showOsVersions={false}
                showCountries={false}
                showNetworkTypes={false}
                showNetworkProviders={false}
                showNetworkGenerations={false}
                showLocales={false}
                showDeviceManufacturers={false}
                showDeviceNames={false}
                showBugReportStatus={false}
                showUdAttrs={false}
                showFreeText={false}
                freeTextPlaceholder='Search User ID, Session Id, Bug Report ID or description..'
                onFiltersChanged={handleFiltersChanged} />
            <div className="py-4" />

            {/* Error state for alerts fetch */}
            {pageState.filters.ready
                && pageState.alertsOverviewApiStatus === AlertsOverviewApiStatus.Error
                && <p className="text-lg font-display">Error fetching list of alerts, please change filters, refresh page or select a different app to try again</p>}

            {/* Main alerts list UI */}
            {pageState.filters.ready
                && (pageState.alertsOverviewApiStatus === AlertsOverviewApiStatus.Success || pageState.alertsOverviewApiStatus === AlertsOverviewApiStatus.Loading) &&
                <div className="flex flex-col items-center w-full">
                    <div className='self-end'>
                        <Paginator
                            prevEnabled={pageState.alertsOverviewApiStatus === AlertsOverviewApiStatus.Loading ? false : pageState.alertsOverview.meta.previous}
                            nextEnabled={pageState.alertsOverviewApiStatus === AlertsOverviewApiStatus.Loading ? false : pageState.alertsOverview.meta.next}
                            displayText=''
                            onNext={handleNextPage}
                            onPrev={handlePrevPage}
                        />
                    </div>
                    <div className={`py-1 w-full ${pageState.alertsOverviewApiStatus === AlertsOverviewApiStatus.Loading ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>
                    <div className="py-4" />
                    <Table className="font-display">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60%]">Alert</TableHead>
                                <TableHead className="w-[20%] text-center">Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pageState.alertsOverview.results?.map(({ id, team_id, app_id, entity_id, type, message, url, created_at, updated_at }, idx) => {
                                return (
                                    <TableRow
                                        key={`${idx}-${id}`}
                                        className="font-body hover:bg-yellow-200 focus-visible:border-yellow-200 select-none"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                router.push(url)
                                            }
                                        }}
                                    >
                                        <TableCell className="w-[60%] relative p-0">
                                            <a
                                                href={url}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-label={`ID: ${id}`}
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className="truncate text-xs text-gray-500 select-none">ID: {id}</p>
                                                <div className='py-1' />
                                                <p className='truncate select-none'>{message}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[20%] text-center relative p-0">
                                            <a
                                                href={url}
                                                className="absolute inset-0 z-10 cursor-pointer"
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                style={{ display: 'block' }}
                                            />
                                            <div className="pointer-events-none p-4">
                                                <p className='truncate select-none'>{formatDateToHumanReadableDate(created_at)}</p>
                                                <div className='py-1' />
                                                <p className='text-xs truncate select-none'>{formatDateToHumanReadableTime(created_at)}</p>
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