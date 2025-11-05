"use client"

import { EventTargetingApiStatus, EventTargetingResponse, emptyEventTargetingResponse, fetchEventTargetingRulesFromServer, TraceTargetingApiStatus, TraceTargetingResponse, emptyTraceTargetingResponse, fetchTraceTargetingRulesFromServer, FilterSource, EventTargetingCollectionConfig, TraceTargetingCollectionConfig, SessionTargetingResponse, emptySessionTargetingResponse, fetchSessionTargetingRulesFromServer } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import LoadingBar from '@/app/components/loading_bar'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/app/components/button'
import { Plus, Pencil } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/dropdown_menu'
import EditDefaultRuleDialog from '@/app/components/targeting/edit_default_rule_dialog'
import RulesOverridesTable from '@/app/components/targeting/rule_overrides_table'
import SessionTargetingTable from '@/app/components/targeting/session_targeting_table'
import { toastPositive, toastNegative } from '@/app/utils/use_toast'

interface PageState {
    eventTargetingApiStatus: EventTargetingApiStatus
    traceTargetingApiStatus: TraceTargetingApiStatus
    filters: typeof defaultFilters
    eventTargetingRules: EventTargetingResponse
    traceTargetingRules: TraceTargetingResponse
    sessionTargetingRules: SessionTargetingResponse
    eventPaginationOffset: number
    tracePaginationOffset: number
    sessionPaginationOffset: number
    editingDefaultRule: 'event' | 'trace' | null
}

const paginationLimit = 5

const getCollectionConfigDisplay = (collectionConfig: EventTargetingCollectionConfig | TraceTargetingCollectionConfig): string => {
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

export default function DataFilters({ params }: { params: { teamId: string } }) {
    const router = useRouter()

    const initialState: PageState = {
        eventTargetingApiStatus: EventTargetingApiStatus.Success,
        traceTargetingApiStatus: TraceTargetingApiStatus.Success,
        filters: defaultFilters,
        eventTargetingRules: emptyEventTargetingResponse,
        traceTargetingRules: emptyTraceTargetingResponse,
        sessionTargetingRules: emptySessionTargetingResponse,
        eventPaginationOffset: 0,
        tracePaginationOffset: 0,
        sessionPaginationOffset: 0,
        editingDefaultRule: null,
    }

    const [pageState, setPageState] = useState<PageState>(initialState)

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const getAllDataFilters = async () => {
        updatePageState({
            eventTargetingApiStatus: EventTargetingApiStatus.Loading,
            traceTargetingApiStatus: TraceTargetingApiStatus.Loading
        })

        const [eventResult, traceResult, sessionResult] = await Promise.all([
            fetchEventTargetingRulesFromServer(pageState.filters.app!.id, paginationLimit, pageState.eventPaginationOffset),
            fetchTraceTargetingRulesFromServer(pageState.filters.app!.id, paginationLimit, pageState.tracePaginationOffset),
            fetchSessionTargetingRulesFromServer(pageState.filters.app!.id, paginationLimit, pageState.sessionPaginationOffset)
        ])

        if (eventResult.status === EventTargetingApiStatus.Error || traceResult.status === TraceTargetingApiStatus.Error) {
            updatePageState({
                eventTargetingApiStatus: EventTargetingApiStatus.Error,
                traceTargetingApiStatus: TraceTargetingApiStatus.Error
            })
            return
        }

        const eventStatus = eventResult.status === EventTargetingApiStatus.NoData
            ? EventTargetingApiStatus.NoData
            : EventTargetingApiStatus.Success
        const traceStatus = traceResult.status === TraceTargetingApiStatus.NoData
            ? TraceTargetingApiStatus.NoData
            : TraceTargetingApiStatus.Success

        updatePageState({
            eventTargetingApiStatus: eventStatus,
            traceTargetingApiStatus: traceStatus,
            eventTargetingRules: eventResult.data || emptyEventTargetingResponse,
            traceTargetingRules: traceResult.data || emptyTraceTargetingResponse,
            sessionTargetingRules: sessionResult.data || emptySessionTargetingResponse
        })
    }

    const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
        // update filters only if they have changed
        if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
            updatePageState({
                filters: updatedFilters,
                eventTargetingRules: emptyEventTargetingResponse,
                traceTargetingRules: emptyTraceTargetingResponse,
                eventPaginationOffset: 0,
                tracePaginationOffset: 0,
            })
        }
    }

    const handleEventNextPage = () => {
        updatePageState({ eventPaginationOffset: pageState.eventPaginationOffset + paginationLimit })
    }

    const handleEventPrevPage = () => {
        updatePageState({ eventPaginationOffset: Math.max(0, pageState.eventPaginationOffset - paginationLimit) })
    }

    const handleTraceNextPage = () => {
        updatePageState({ tracePaginationOffset: pageState.tracePaginationOffset + paginationLimit })
    }

    const handleTracePrevPage = () => {
        updatePageState({ tracePaginationOffset: Math.max(0, pageState.tracePaginationOffset - paginationLimit) })
    }

    const handleSessionNextPage = () => {
        updatePageState({ sessionPaginationOffset: pageState.sessionPaginationOffset + paginationLimit })
    }

    const handleSessionPrevPage = () => {
        updatePageState({ sessionPaginationOffset: Math.max(0, pageState.sessionPaginationOffset - paginationLimit) })
    }

    useEffect(() => {
        if (!pageState.filters.ready) {
            return
        }

        // update url
        router.replace(`?${pageState.filters.serialisedFilters!}`, { scroll: false })

        // TODO: Re-enable API call when ready
        // getDataFilters()
    }, [pageState.filters, pageState.eventPaginationOffset, pageState.tracePaginationOffset, pageState.sessionPaginationOffset])

    const isLoading = () => {
        return pageState.eventTargetingApiStatus === EventTargetingApiStatus.Loading ||
            pageState.traceTargetingApiStatus === TraceTargetingApiStatus.Loading
    }

    const hasError = () => {
        return pageState.eventTargetingApiStatus === EventTargetingApiStatus.Error ||
            pageState.traceTargetingApiStatus === TraceTargetingApiStatus.Error
    }

    const canShowContent = () => {
        const eventReady = pageState.eventTargetingApiStatus === EventTargetingApiStatus.Success ||
            pageState.eventTargetingApiStatus === EventTargetingApiStatus.Loading
        const traceReady = pageState.traceTargetingApiStatus === TraceTargetingApiStatus.Success ||
            pageState.traceTargetingApiStatus === TraceTargetingApiStatus.Loading
        return pageState.filters.ready && eventReady && traceReady
    }

    const eventsDefaultRule = pageState.eventTargetingRules.result.default;
    const eventsOverideRules = pageState.eventTargetingRules.result.overrides;
    const traceDefaultRule = pageState.traceTargetingRules.result.default;
    const traceOverrideRules = pageState.traceTargetingRules.result.overrides;
    const sessionTargetingRules = pageState.sessionTargetingRules.results;

    const handleEditRule = (dataFilter: typeof eventsOverideRules[0] | typeof traceOverrideRules[0] | typeof sessionTargetingRules[0], filterType: 'event' | 'trace' | 'session') => {
        router.push(`/${params.teamId}/data/${filterType}/${dataFilter.id}/edit`)
    }

    const handleDefaultRuleUpdateSuccess = (collectionMode: 'sample_rate' | 'timeline_only' | 'disable', sampleRate?: number) => {
        if (pageState.editingDefaultRule === 'event') {
            const updatedEventRules = {
                ...pageState.eventTargetingRules,
                result: {
                    ...pageState.eventTargetingRules.result,
                    default: {
                        ...pageState.eventTargetingRules.result.default,
                        collection_config: collectionMode === 'sample_rate'
                            ? { mode: 'sample_rate' as const, sample_rate: sampleRate! }
                            : collectionMode === 'timeline_only'
                                ? { mode: 'timeline_only' as const }
                                : { mode: 'disable' as const }
                    }
                }
            }
            updatePageState({ eventTargetingRules: updatedEventRules })
        } else if (pageState.editingDefaultRule === 'trace') {
            const updatedTraceRules = {
                ...pageState.traceTargetingRules,
                result: {
                    ...pageState.traceTargetingRules.result,
                    default: {
                        ...pageState.traceTargetingRules.result.default,
                        collection_config: collectionMode === 'sample_rate'
                            ? { mode: 'sample_rate' as const, sample_rate: sampleRate! }
                            : collectionMode === 'timeline_only'
                                ? { mode: 'timeline_only' as const }
                                : { mode: 'disable' as const }
                    }
                }
            }
            updatePageState({ traceTargetingRules: updatedTraceRules })
        }

        toastPositive('Rule updated successfully')
    }

    const handleDefaultRuleUpdateError = (error: string) => {
        toastNegative('Failed to update rule', error)
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
                            disabled={pageState.eventTargetingApiStatus === EventTargetingApiStatus.Loading}
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
                        <DropdownMenuItem onClick={() => router.push(`/${params.teamId}/data/session/create`)}>
                            Session Rule
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
            {pageState.filters.ready && hasError() &&
                <p className="text-lg font-display">Error fetching data filters, please change filters, refresh page or select a different app to try again</p>}

            {/* Main data rules UI */}
            {canShowContent() &&
                <div className="flex flex-col items-start w-full">
                    <div className={`py-1 w-full ${isLoading() ? 'visible' : 'invisible'}`}>
                        <LoadingBar />
                    </div>

                    {/* Event Rules Section */}
                    <div className="w-full">
                        <p className="font-display text-2xl">Event Rules</p>
                        <div className="py-4" />

                        {/* Default Event Rule */}
                        <div className="flex items-center gap-2">
                            <p className="font-display text-gray-500">Default Rule</p>
                            {eventsDefaultRule && (
                                <button
                                    onClick={() => updatePageState({ editingDefaultRule: 'event' })}
                                    className="p-1 hover:bg-yellow-200 rounded"
                                >
                                    <Pencil className="w-4 h-4 text-gray-600" />
                                </button>
                            )}
                        </div>
                        <div className="py-2" />
                        {eventsDefaultRule && (
                            <div className="text-sm font-body text-gray-700">
                                {getCollectionConfigDisplay(eventsDefaultRule.collection_config)}
                            </div>
                        )}

                        <RulesOverridesTable
                            rules={eventsOverideRules}
                            onRuleClick={(rule) => handleEditRule(rule, 'event')}
                            prevEnabled={pageState.eventTargetingRules.meta.previous}
                            nextEnabled={pageState.eventTargetingRules.meta.next}
                            onNext={handleEventNextPage}
                            onPrev={handleEventPrevPage}
                            showPaginator={eventsOverideRules.length > 0}
                        />
                    </div>

                    <div className="py-12" />

                    {/* Trace Rules Section */}
                    <div className="w-full">
                        <p className="font-display text-2xl">Trace Rules</p>
                        <div className="py-4" />

                        {/* Default Trace Rule */}
                        <div className="flex items-center gap-2">
                            <p className="font-display text-gray-500">Default Rule</p>
                            {traceDefaultRule && (
                                <button
                                    onClick={() => updatePageState({ editingDefaultRule: 'trace' })}
                                    className="p-1 hover:bg-yellow-200 rounded"
                                >
                                    <Pencil className="w-4 h-4 text-gray-600" />
                                </button>
                            )}
                        </div>
                        <div className="py-2" />
                        {traceDefaultRule && (
                            <div className="text-sm font-body text-gray-700">
                                {getCollectionConfigDisplay(traceDefaultRule.collection_config)}
                            </div>
                        )}

                        <RulesOverridesTable
                            rules={traceOverrideRules}
                            onRuleClick={(rule) => handleEditRule(rule, 'trace')}
                            prevEnabled={pageState.traceTargetingRules.meta.previous}
                            nextEnabled={pageState.traceTargetingRules.meta.next}
                            onNext={handleTraceNextPage}
                            onPrev={handleTracePrevPage}
                            showPaginator={traceOverrideRules.length > 0}
                        />
                    </div>

                    <div className="py-12" />

                    {/* Session Timeline Rules Section */}
                    <div className="w-full">
                        <p className="font-display text-2xl">Session Timeline Rules</p>

                        <div className="py-4" />

                        <SessionTargetingTable
                            rules={sessionTargetingRules}
                            onRuleClick={(rule) => handleEditRule(rule, 'session')}
                            prevEnabled={pageState.sessionTargetingRules.meta.previous}
                            nextEnabled={pageState.sessionTargetingRules.meta.next}
                            onNext={handleSessionNextPage}
                            onPrev={handleSessionPrevPage}
                            showPaginator={sessionTargetingRules.length > 0}
                        />
                    </div>
                </div>}

            {/* Default Rule Edit Dialog */}
            {pageState.editingDefaultRule && (
                <EditDefaultRuleDialog
                    isOpen={true}
                    onClose={() => updatePageState({ editingDefaultRule: null })}
                    onSuccess={handleDefaultRuleUpdateSuccess}
                    onError={handleDefaultRuleUpdateError}
                    ruleType={pageState.editingDefaultRule}
                    ruleId={
                        pageState.editingDefaultRule === 'event'
                            ? eventsDefaultRule.id
                            : traceDefaultRule.id
                    }
                    appId={pageState.filters.app!.id}
                    initialCollectionMode={
                        pageState.editingDefaultRule === 'event'
                            ? eventsDefaultRule.collection_config.mode
                            : traceDefaultRule.collection_config.mode
                    }
                    initialSampleRate={
                        pageState.editingDefaultRule === 'event'
                            ? (eventsDefaultRule.collection_config.mode === 'sample_rate' ? eventsDefaultRule.collection_config.sample_rate : undefined)
                            : (traceDefaultRule.collection_config.mode === 'sample_rate' ? traceDefaultRule.collection_config.sample_rate : undefined)
                    }
                />
            )}
        </div>
    )
}
