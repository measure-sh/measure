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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/dropdown_menu'
import EditDefaultRuleDialog, { DefaultRuleState } from '@/app/components/data/edit_default_rule_dialog'

interface PageState {
    dataFiltersApiStatus: DataFiltersApiStatus
    filters: typeof defaultFilters
    dataFilters: DataFiltersResponse
    defaultRuleEditState: DefaultRuleState | null
}

const isDefaultRule = (type: DataFilterType): boolean => {
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
            return `Collect all at ${collectionConfig.sample_rate}% sample rate`
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

    const initialState: PageState = {
        dataFiltersApiStatus: DataFiltersApiStatus.Success,
        filters: defaultFilters,
        dataFilters: emptyDataFiltersResponse,
        defaultRuleEditState: null,
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

    const defaultRules = pageState.dataFilters.results.filter(df => isDefaultRule(df.type))
    const allEventsFilter = defaultRules.find(df => df.type === 'all_events')
    const allTracesFilter = defaultRules.find(df => df.type === 'all_traces')
    const overrideFilters = pageState.dataFilters.results.filter(df => !isDefaultRule(df.type))
    const eventFilters = overrideFilters.filter(df => df.type === 'event')
    const traceFilters = overrideFilters.filter(df => df.type === 'trace')

    const handleEditFilter = (dataFilter: typeof overrideFilters[0]) => {
        const filterType = dataFilter.type === 'event' ? 'event' : 'trace'
        router.push(`/${params.teamId}/data/${filterType}/${dataFilter.id}/edit`)
    }

    const handleEditDefaultRule = (dataFilter: typeof defaultRules[0]) => {
        updatePageState({
            defaultRuleEditState: {
                id: dataFilter.id,
                type: dataFilter.type,
                collectionMode: dataFilter.collection_config.mode,
                sampleRate: dataFilter.collection_config.mode === 'sample_rate' ? dataFilter.collection_config.sample_rate : undefined
            }
        })
    }

    const handleSaveDefaultRule = () => {
        updatePageState({ defaultRuleEditState: null })
    }

    const handleCancelDefaultRule = () => {
        updatePageState({ defaultRuleEditState: null })
    }

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <div className="flex flex-row items-center gap-2 justify-between w-full">
                <p className="font-display text-4xl max-w-6xl text-center">Data Control</p>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="font-display border border-black select-none"
                            disabled={pageState.dataFiltersApiStatus === DataFiltersApiStatus.Loading}
                        >
                            <Plus /> Create Rule
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/${params.teamId}/data/event/create`)}>
                            Event Rule
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/${params.teamId}/data/trace/create`)}>
                            Trace Rule
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

            <div className="py-2" />

            {/* Error state for data rules fetch */}
            {pageState.filters.ready
                && pageState.dataFiltersApiStatus === DataFiltersApiStatus.Error
                && <p className="text-lg font-display">Error fetching data filters, please change filters, refresh page or select a different app to try again</p>}

            {/* Main data rules UI */}
            {pageState.filters.ready
                && (pageState.dataFiltersApiStatus === DataFiltersApiStatus.Success || pageState.dataFiltersApiStatus === DataFiltersApiStatus.Loading) &&
                <div className="flex flex-col items-start w-full">
                    <div className={`py-1 w-full ${pageState.dataFiltersApiStatus === DataFiltersApiStatus.Loading ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>

                    {/* Event Rules Section */}
                    <div className="w-full">
                        <p className="font-display text-2xl">Event Rules</p>
                        <div className="py-4" />

                        {/* Default Event Rule */}
                        <div className="flex items-center gap-2">
                            <p className="font-display text-gray-500">Default Rule</p>
                            {allEventsFilter && (
                                <button
                                    onClick={() => handleEditDefaultRule(allEventsFilter)}
                                    className="p-1 hover:bg-yellow-200 rounded"
                                >
                                    <Pencil className="w-4 h-4 text-gray-600" />
                                </button>
                            )}
                        </div>
                        <div className="py-2" />
                        {allEventsFilter && (
                            <div className="text-sm font-body text-gray-700">
                                {getCollectionConfigDisplay(allEventsFilter.collection_config)}
                            </div>
                        )}

                        {eventFilters.length > 0 && (
                            <>
                                <div className="py-6" />
                                {/* Event Overrides */}
                                <p className="font-display text-gray-500">Overrides</p>
                                <div className="py-2" />
                                <Table className="font-display">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[52%]">Rule</TableHead>
                                        <TableHead className="w-[24%] text-center">Updated At</TableHead>
                                        <TableHead className="w-[24%] text-center">Updated By</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {eventFilters.map((dataFilter, idx) => (
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
                            </>
                        )}
                    </div>

                    <div className="py-12" />

                    {/* Trace Rules Section */}
                    <div className="w-full">
                        <p className="font-display text-2xl">Trace Rules</p>
                        <div className="py-4" />

                        {/* Default Trace Rule */}
                        <div className="flex items-center gap-2">
                            <p className="font-display text-gray-500">Default Rule</p>
                            {allTracesFilter && (
                                <button
                                    onClick={() => handleEditDefaultRule(allTracesFilter)}
                                    className="p-1 hover:bg-yellow-200 rounded"
                                >
                                    <Pencil className="w-4 h-4 text-gray-600" />
                                </button>
                            )}
                        </div>
                        <div className="py-2" />
                        {allTracesFilter && (
                            <div className="text-sm font-body text-gray-700">
                                {getCollectionConfigDisplay(allTracesFilter.collection_config)}
                            </div>
                        )}

                        {traceFilters.length > 0 && (
                            <>
                                <div className="py-6" />
                                {/* Trace Overrides */}
                                <p className="font-display text-gray-500">Overrides</p>
                                <div className="py-2" />
                                <Table className="font-display">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[52%]">Rule</TableHead>
                                        <TableHead className="w-[24%] text-center">Updated At</TableHead>
                                        <TableHead className="w-[24%] text-center">Updated By</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {traceFilters.map((dataFilter, idx) => (
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
                            </>
                        )}
                    </div>
                </div>}

            {/* Default Rule Edit Dialog */}
            <EditDefaultRuleDialog
                isOpen={pageState.defaultRuleEditState !== null}
                defaultRule={pageState.defaultRuleEditState}
                onClose={handleCancelDefaultRule}
                onSave={handleSaveDefaultRule}
                onUpdate={(updatedRule) => updatePageState({ defaultRuleEditState: updatedRule })}
            />
        </div>
    )
}
