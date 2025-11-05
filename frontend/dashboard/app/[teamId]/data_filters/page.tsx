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
import { Plus, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/app/components/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/dropdown_menu'
import SamplingRateInput from '@/app/components/data_filters/sampling_rate_input'

interface PageState {
    dataFiltersApiStatus: DataFiltersApiStatus
    filters: typeof defaultFilters
    dataFilters: DataFiltersResponse
    editingGlobalFilter: {
        id: string
        type: DataFilterType
        collectionMode: DataFilterCollectionConfig['mode']
        sampleRate?: number
    } | null
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
        editingGlobalFilter: null,
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

    const handleEditGlobalFilter = (dataFilter: typeof globalFilters[0], e: React.MouseEvent) => {
        e.stopPropagation()
        updatePageState({
            editingGlobalFilter: {
                id: dataFilter.id,
                type: dataFilter.type,
                collectionMode: dataFilter.collection_config.mode,
                sampleRate: dataFilter.collection_config.mode === 'sample_rate' ? dataFilter.collection_config.sample_rate : undefined
            }
        })
    }

    const handleSaveGlobalFilter = () => {
        // TODO: Implement save logic
        updatePageState({ editingGlobalFilter: null })
    }

    const handleCancelGlobalFilter = () => {
        updatePageState({ editingGlobalFilter: null })
    }

    const handleEditFilter = (dataFilter: typeof overrideFilters[0]) => {
        const filterType = dataFilter.type === 'event' ? 'event' : 'trace'
        router.push(`/${params.teamId}/data_filters/${filterType}/${dataFilter.id}/edit`)
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
                            disabled={pageState.dataFiltersApiStatus === DataFiltersApiStatus.Loading}
                        >
                            <Plus /> Create Filter
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/${params.teamId}/data_filters/event/create`)}>
                            Event Filter
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/${params.teamId}/data_filters/trace/create`)}>
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
                        <div className="flex flex-col gap-3 w-full">
                            {globalFilters.map((dataFilter, idx) => (
                                <Card
                                    key={`${idx}-${dataFilter.id}`}
                                    className={`w-full ${dataFilter.type === 'all_events' ? 'bg-blue-100' : 'bg-purple-100'}`}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex flex-row items-center justify-between">
                                            <div className="flex-1">
                                                <p className='select-none text-base font-display mb-1'>{getFilterDisplayText(dataFilter.type, dataFilter.filter)}</p>
                                                <p className='text-xs text-gray-700 select-none'>{getCollectionConfigDisplay(dataFilter.collection_config)}{getAttachmentConfigDisplay(dataFilter.attachment_config) && ` • ${getAttachmentConfigDisplay(dataFilter.attachment_config)}`}</p>
                                            </div>
                                            <div className="flex items-center gap-4 ml-6">
                                                <div className="flex items-center gap-4 text-xs text-gray-600">
                                                    <span className='select-none'>{formatDateToHumanReadableDate(dataFilter.updated_at)} at {formatDateToHumanReadableTime(dataFilter.updated_at)}</span>
                                                    <span className='select-none'>•</span>
                                                    <span className='select-none'>{dataFilter.updated_by}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => handleEditGlobalFilter(dataFilter, e)}
                                                    className="p-2 hover:bg-gray-200 rounded"
                                                >
                                                    <Pencil className="w-4 h-4 text-gray-600" />
                                                </button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    <div className="py-8" />

                    {/* Override Filters Section */}
                    {(
                        overrideFilters.length === 0 ? (
                            <div className="w-full py-12 text-center">
                                <p className="text-gray-500 text-sm">
                                    Click "Create Filter" to override the global filter settings for any event or trace
                                </p>
                            </div>
                        ) : (
                            <div className="w-full">
                                <div className="mb-4">
                                    <p className="font-display text-2xl">Filters</p>
                                    <p className="text-sm text-gray-600 mt-1">Add filters for events and traces that override global settings</p>
                                </div>

                                <div className="py-2" />

                                <div>

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
                                                className="font-body cursor-pointer hover:bg-yellow-200 focus-visible:border-yellow-200 select-none"
                                                onClick={() => handleEditFilter(dataFilter)}
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
                            </div>
                        )
                    )}
                </div>}

            {/* Global Filter Edit Dialog */}
            <Dialog open={pageState.editingGlobalFilter !== null} onOpenChange={(open) => !open && handleCancelGlobalFilter()}>
                <DialogContent className="font-display">
                    <DialogHeader>
                        <DialogTitle className="font-display text-2xl">
                            Edit {pageState.editingGlobalFilter?.type === 'all_events' ? 'Events' : 'Traces'} Filter
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-4">
                        <label className="flex items-center gap-3 cursor-pointer h-10">
                            <input
                                type="radio"
                                name="collectionMode"
                                value="sample_rate"
                                checked={pageState.editingGlobalFilter?.collectionMode === 'sample_rate'}
                                onChange={(e) => updatePageState({
                                    editingGlobalFilter: pageState.editingGlobalFilter ? {
                                        ...pageState.editingGlobalFilter,
                                        collectionMode: 'sample_rate',
                                        sampleRate: pageState.editingGlobalFilter.sampleRate || 100
                                    } : null
                                })}
                                className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                            />
                            <SamplingRateInput
                                value={pageState.editingGlobalFilter?.sampleRate || 100}
                                onChange={(value) => updatePageState({
                                    editingGlobalFilter: pageState.editingGlobalFilter ? {
                                        ...pageState.editingGlobalFilter,
                                        collectionMode: 'sample_rate',
                                        sampleRate: value
                                    } : null
                                })}
                                disabled={pageState.editingGlobalFilter?.collectionMode !== 'sample_rate'}
                            />
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer h-10">
                            <input
                                type="radio"
                                name="collectionMode"
                                value="timeline_only"
                                checked={pageState.editingGlobalFilter?.collectionMode === 'timeline_only'}
                                onChange={(e) => updatePageState({
                                    editingGlobalFilter: pageState.editingGlobalFilter ? {
                                        ...pageState.editingGlobalFilter,
                                        collectionMode: 'timeline_only'
                                    } : null
                                })}
                                className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                            />
                            <span className="text-sm font-body">Collect with session timeline only</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer h-10">
                            <input
                                type="radio"
                                name="collectionMode"
                                value="disable"
                                checked={pageState.editingGlobalFilter?.collectionMode === 'disable'}
                                onChange={(e) => updatePageState({
                                    editingGlobalFilter: pageState.editingGlobalFilter ? {
                                        ...pageState.editingGlobalFilter,
                                        collectionMode: 'disable'
                                    } : null
                                })}
                                className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                            />
                            <span className="text-sm font-body">Collect no {pageState.editingGlobalFilter?.type === 'all_events' ? 'events' : 'traces'}</span>
                        </label>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={handleCancelGlobalFilter}
                            className="font-display"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleSaveGlobalFilter}
                            className="font-display border border-black"
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
