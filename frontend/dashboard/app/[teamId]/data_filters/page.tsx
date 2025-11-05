"use client"

import { DataFiltersApiStatus, DataFiltersResponse, emptyDataFiltersResponse, fetchDataFiltersFromServer, FilterSource } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingBar from '@/app/components/loading_bar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'

import { DataFilterAttachmentConfig, DataFilterCollectionConfig } from '@/app/api/api_calls'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from '@/app/utils/time_utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PageState {
    dataFiltersApiStatus: DataFiltersApiStatus
    filters: typeof defaultFilters
    dataFilters: DataFiltersResponse
}

const getCollectionConfigDisplay = (collectionConfig: DataFilterCollectionConfig): string => {
    switch (collectionConfig.mode) {
        case 'sample_rate':
            return `Sample Rate: ${collectionConfig.sample_rate * 100}%`
        case 'timeline_only':
            return 'Timeline Only'
        case 'disable':
            return 'Do not collect'
        default:
            return 'Unknown'
    }
}

const getAttachmentConfigDisplay = (attachmentConfig: DataFilterAttachmentConfig | null): string => {
    if (!attachmentConfig || attachmentConfig === 'none') {
        return 'With no attachments'
    } else if (attachmentConfig === 'layout_snapshot') {
        return 'With layout snapshot'
    } else if (attachmentConfig === 'screenshot') {
        return 'With screenshot'
    }
    return attachmentConfig
}

export default function DataFilters({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const initialState: PageState = {
        dataFiltersApiStatus: DataFiltersApiStatus.Success,
        filters: defaultFilters,
        dataFilters: emptyDataFiltersResponse,
    }

    const [pageState, setPageState] = useState<PageState>(initialState)

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const getDataFilters = async () => {
        updatePageState({ dataFiltersApiStatus: DataFiltersApiStatus.Loading })

        const result = await fetchDataFiltersFromServer(pageState.filters.app!.id)

        switch (result.status) {
            case DataFiltersApiStatus.Error:
                updatePageState({ dataFiltersApiStatus: DataFiltersApiStatus.Error })
                break
            case DataFiltersApiStatus.NoFilters:
                updatePageState({ dataFiltersApiStatus: DataFiltersApiStatus.NoFilters })
                break
            case DataFiltersApiStatus.Success:
                updatePageState({
                    dataFiltersApiStatus: DataFiltersApiStatus.Success,
                    dataFilters: result.data
                })
                break
        }
    }

    const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
        // update filters only if they have changed
        if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
            updatePageState({
                filters: updatedFilters,
                dataFilters: emptyDataFiltersResponse,
            })
        }
    }

    useEffect(() => {
        if (!pageState.filters.ready) {
            return
        }

        // update url
        router.replace(`?${pageState.filters.serialisedFilters!}`, { scroll: false })

        // TODO: Re-enable API call when ready
        // getDataFilters()
    }, [pageState.filters])

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Data Filters</p>
            <div className="py-4" />

            <Filters
                teamId={params.teamId}
                filterSource={FilterSource.Events}
                appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
                showNoData={true}
                showNotOnboarded={false}
                showAppSelector={true}
                showAppVersions={false}
                showDates={false}
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
                freeTextPlaceholder={""}
                onFiltersChanged={handleFiltersChanged} />
            <div className="py-4" />

            {/* Error state for bug reports fetch */}
            {pageState.filters.ready
                && pageState.dataFiltersApiStatus === DataFiltersApiStatus.Error
                && <p className="text-lg font-display">Error fetching data filters, please change filters, refresh page or select a different app to try again</p>}

            {/* Main bug reports list UI */}
            {pageState.filters.ready
                && (pageState.dataFiltersApiStatus === DataFiltersApiStatus.Success || pageState.dataFiltersApiStatus === DataFiltersApiStatus.Loading) &&
                <div className="flex flex-col items-center w-full">
                    <div className={`py-1 w-full ${pageState.dataFiltersApiStatus === DataFiltersApiStatus.Loading ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>
                    <div className="py-4" />
                    <Table className="font-display">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60%]">Filter</TableHead>
                                <TableHead className="w-[20%] text-center">Updated At</TableHead>
                                <TableHead className="w-[20%] text-center">Updated By</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pageState.dataFilters.results.map((dataFilter, idx) => (
                                <TableRow
                                    key={`${idx}-${dataFilter.id}`}
                                    className="font-body"
                                >
                                    <TableCell className="w-[40%] p-4">
                                        <p className='truncate select-none font-mono text-sm'>{dataFilter.filter}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate text-gray-500 select-none'>{getCollectionConfigDisplay(dataFilter.collection_config)}</p>
                                        <p className='text-xs truncate text-gray-500 select-none'>{getAttachmentConfigDisplay(dataFilter.attachment_config)}</p>
                                    </TableCell>
                                    <TableCell className="w-[15%] text-center p-4">
                                        <p className='truncate select-none'>{formatDateToHumanReadableDate(dataFilter.updated_at)}</p>
                                        <div className='py-1' />
                                        <p className='text-xs truncate select-none'>{formatDateToHumanReadableTime(dataFilter.updated_at)}</p>
                                    </TableCell>
                                    <TableCell className="w-[15%] text-center p-4">
                                        <p className='truncate select-none'>{dataFilter.updated_by}</p>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>}
        </div>
    )
}
