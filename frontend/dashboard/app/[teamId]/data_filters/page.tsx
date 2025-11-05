"use client"

import { DataFiltersApiStatus, DataFiltersResponse, emptyDataFiltersResponse, fetchDataFiltersFromServer, FilterSource } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingBar from '@/app/components/loading_bar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/table'

import { DataFilterAttachmentConfig, DataFilterCollectionConfig, DataFilterType } from '@/app/api/api_calls'
import { formatDateToHumanReadableDate, formatDateToHumanReadableTime } from '@/app/utils/time_utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/app/components/button'
import { Plus } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/dropdown_menu'
import { Card, CardContent, CardFooter } from '@/app/components/card'

interface PageState {
    dataFiltersApiStatus: DataFiltersApiStatus
    filters: typeof defaultFilters
    dataFilters: DataFiltersResponse
    editingFilterType: 'event' | 'trace' | null
}

const isGlobalFilter = (type: DataFilterType): boolean => {
    return type === 'all_events' || type === 'all_traces'
}

const getFilterDisplayText = (type: DataFilterType, filter: string): string => {
    switch (type) {
        case 'all_events':
            return 'All Events'
        case 'all_traces':
            return 'All Traces'
        default:
            return filter
    }
}

const getCollectionConfigDisplay = (collectionConfig: DataFilterCollectionConfig): string => {
    switch (collectionConfig.mode) {
        case 'sample_rate':
            return `Collect at ${collectionConfig.sample_rate}% sample rate`
        case 'timeline_only':
            return 'Collect with session timeline only'
        case 'disable':
            return 'Do not collect'
        default:
            return 'Unknown'
    }
}

const getAttachmentConfigDisplay = (attachmentConfig: DataFilterAttachmentConfig | null): string => {
    if (!attachmentConfig || attachmentConfig === 'none') {
        return ''
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
        editingFilterType: null,
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

    const globalFilters = pageState.dataFilters.results.filter(df => isGlobalFilter(df.type))
    const overrideFilters = pageState.dataFilters.results.filter(df => !isGlobalFilter(df.type))

    const handleCancel = () => {
        updatePageState({ editingFilterType: null })
    }

    const handleCreateFilter = () => {
        updatePageState({ editingFilterType: null })
    }

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">

            <div className="flex flex-row items-center gap-2 justify-between w-full">
                <p className="font-display text-4xl max-w-6xl text-center">Data Filters</p>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="font-display border border-black select-none"
                            disabled={pageState.dataFiltersApiStatus === DataFiltersApiStatus.Loading || pageState.editingFilterType !== null}
                        >
                            <Plus /> Create Filter
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updatePageState({ editingFilterType: 'event' })}>
                            Event Filter
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updatePageState({ editingFilterType: 'trace' })}>
                            Trace Filter
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
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

            {/* Filter creation card */}
            {pageState.editingFilterType && (
                <>
                    <Card className="w-full">
                        <CardContent className="pt-6">
                            <div className="mb-6">
                            </div>
                        </CardContent>

                        <CardFooter className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={handleCancel}
                                className="font-display"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleCreateFilter}
                                className="font-display border border-black"
                            >
                                Create Filter
                            </Button>
                        </CardFooter>
                    </Card>
                    <div className="py-12" />
                </>
            )}

            {/* Error state for data filters fetch */}
            {pageState.filters.ready
                && pageState.dataFiltersApiStatus === DataFiltersApiStatus.Error
                && <p className="text-lg font-display">Error fetching data filters, please change filters, refresh page or select a different app to try again</p>}

            {/* Main data filters UI */}
            {pageState.filters.ready
                && (pageState.dataFiltersApiStatus === DataFiltersApiStatus.Success || pageState.dataFiltersApiStatus === DataFiltersApiStatus.Loading) &&
                <div className="flex flex-col items-start w-full">
                    <div className={`py-1 w-full ${pageState.dataFiltersApiStatus === DataFiltersApiStatus.Loading ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>

                    {/* Global Filters Section */}
                    {globalFilters.length > 0 && (
                        <div className="w-full">
                            <p className="font-display text-2xl">Global Filters</p>

                            <div className="py-4" />

                            <Table className="font-display">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[52%]">Filter</TableHead>
                                        <TableHead className="w-[24%] text-center">Updated At</TableHead>
                                        <TableHead className="w-[24%] text-center">Updated By</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {globalFilters.map((dataFilter, idx) => (
                                        <TableRow
                                            key={`${idx}-${dataFilter.id}`}
                                            className="font-body"
                                        >
                                            <TableCell className="w-[60%] p-4">
                                                <p className='select-none text-base mb-2'>{getFilterDisplayText(dataFilter.type, dataFilter.filter)}</p>
                                                <p className='text-xs truncate text-gray-500 select-none'>{getCollectionConfigDisplay(dataFilter.collection_config)}</p>
                                                <p className='text-xs truncate text-gray-500 select-none'>{getAttachmentConfigDisplay(dataFilter.attachment_config)}</p>
                                            </TableCell>
                                            <TableCell className="w-[20%] text-center p-4">
                                                <p className='truncate select-none'>{formatDateToHumanReadableDate(dataFilter.updated_at)}</p>
                                                <div className='py-1' />
                                                <p className='text-xs truncate select-none'>{formatDateToHumanReadableTime(dataFilter.updated_at)}</p>
                                            </TableCell>
                                            <TableCell className="w-[20%] text-center p-4">
                                                <p className='truncate select-none'>{dataFilter.updated_by}</p>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <div className="py-8" />

                    {/* Override Filters Table */}
                    {overrideFilters.length > 0 && (
                        <div className="w-full">
                            <p className="font-display text-2xl">Overrides</p>

                            <div className="py-4" />

                            <Table className="font-display">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[52%]">Filter</TableHead>
                                        <TableHead className="w-[24%] text-center">Updated At</TableHead>
                                        <TableHead className="w-[24%] text-center">Updated By</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {overrideFilters.map((dataFilter, idx) => (
                                        <TableRow
                                            key={`${idx}-${dataFilter.id}`}
                                            className="font-body"
                                        >
                                            <TableCell className="w-[60%] p-4">
                                                <p className='truncate select-none font-mono text-sm'>{getFilterDisplayText(dataFilter.type, dataFilter.filter)}</p>
                                                <div className='py-1' />
                                                <p className='text-xs truncate text-gray-500 select-none'>{getCollectionConfigDisplay(dataFilter.collection_config)}</p>
                                                <p className='text-xs truncate text-gray-500 select-none'>{getAttachmentConfigDisplay(dataFilter.attachment_config)}</p>
                                            </TableCell>
                                            <TableCell className="w-[20%] text-center p-4">
                                                <p className='truncate select-none'>{formatDateToHumanReadableDate(dataFilter.updated_at)}</p>
                                                <div className='py-1' />
                                                <p className='text-xs truncate select-none'>{formatDateToHumanReadableTime(dataFilter.updated_at)}</p>
                                            </TableCell>
                                            <TableCell className="w-[20%] text-center p-4">
                                                <p className='truncate select-none'>{dataFilter.updated_by}</p>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>}
        </div>
    )
}
