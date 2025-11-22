"use client"

import { EventTargetingApiStatus, EventTargetingRulesResponse, fetchEventTargetingRulesFromServer, TraceTargetingApiStatus, TraceTargetingRulesResponse, fetchTraceTargetingRulesFromServer, FilterSource, CollectionMode, SessionTargetingRulesResponse, fetchSessionTargetingRulesFromServer, EventTargetingRule, TraceTargetingRule, SessionTargetingRule } from '@/app/api/api_calls'
import Filters, { AppVersionsInitialSelectionType, defaultFilters } from '@/app/components/filters'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/app/components/button'
import { Plus, Pencil } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/dropdown_menu'
import EditDefaultRuleDialog from '@/app/components/targeting/edit_default_rule_dialog'
import RulesTable from '@/app/components/targeting/rules_table'
import { toastPositive, toastNegative } from '@/app/utils/use_toast'

interface PageState {
    eventTargetingApiStatus: EventTargetingApiStatus
    traceTargetingApiStatus: TraceTargetingApiStatus
    filters: typeof defaultFilters
    eventTargetingRules: EventTargetingRulesResponse | null
    traceTargetingRules: TraceTargetingRulesResponse | null
    sessionTargetingRules: SessionTargetingRulesResponse | null
    editingDefaultRuleType: 'event' | 'trace' | null
}

const initialState: PageState = {
    eventTargetingApiStatus: EventTargetingApiStatus.Loading,
    traceTargetingApiStatus: TraceTargetingApiStatus.Loading,
    filters: defaultFilters,
    eventTargetingRules: null,
    traceTargetingRules: null,
    sessionTargetingRules: null,
    editingDefaultRuleType: null,
}

export default function DataControlOverview({ params }: { params: { teamId: string } }) {
    const router = useRouter()
    const [pageState, setPageState] = useState<PageState>(initialState)

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const loadAllRules = async () => {
        updatePageState({
            eventTargetingApiStatus: EventTargetingApiStatus.Loading,
            traceTargetingApiStatus: TraceTargetingApiStatus.Loading
        })

        const [eventResult, traceResult, sessionResult] = await Promise.all([
            fetchEventTargetingRulesFromServer(pageState.filters.app!.id),
            fetchTraceTargetingRulesFromServer(pageState.filters.app!.id),
            fetchSessionTargetingRulesFromServer(pageState.filters.app!.id)
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
            eventTargetingRules: eventResult.data,
            traceTargetingRules: traceResult.data,
            sessionTargetingRules: sessionResult.data,
        })
    }

    const handleFiltersChanged = (updatedFilters: typeof defaultFilters) => {
        if (pageState.filters.ready !== updatedFilters.ready || pageState.filters.serialisedFilters !== updatedFilters.serialisedFilters) {
            updatePageState({
                filters: updatedFilters,
                eventTargetingRules: null,
                traceTargetingRules: null,
            })
        }
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

    const getCollectionConfigDisplay = (collectionMode: CollectionMode, samplingRate: number, type: 'event' | 'trace'): string => {
        const typeName = type === 'event' ? 'events' : 'traces'
        switch (collectionMode) {
            case 'sampled':
                return `Collect all ${typeName} at ${samplingRate}% sample rate`
            case 'timeline':
                return `Collect ${typeName} with session timeline only`
            case 'disabled':
                return `Collect no ${typeName} by default`
            default:
                return 'Unknown'
        }
    }

    const handleEditRule = (rule: EventTargetingRule | TraceTargetingRule | SessionTargetingRule, ruleType: 'event' | 'trace' | 'session') => {
        router.push(`/${params.teamId}/data/${pageState.filters.app!.id}/${ruleType}/${rule.id}/edit`)
    }

    const handleDefaultRuleUpdateSuccess = (collectionMode: 'sampled' | 'timeline' | 'disabled', samplingRate?: number) => {
        if (pageState.editingDefaultRuleType === 'event' && pageState.eventTargetingRules) {
            const updatedEventRules = {
                ...pageState.eventTargetingRules,
                default_rule: {
                    ...pageState.eventTargetingRules.default_rule,
                    collection_mode: collectionMode,
                    sampling_rate: samplingRate || 0
                }
            }
            updatePageState({ eventTargetingRules: updatedEventRules })
        } else if (pageState.editingDefaultRuleType === 'trace' && pageState.traceTargetingRules) {
            const updatedTraceRules = {
                ...pageState.traceTargetingRules,
                default_rule: {
                    ...pageState.traceTargetingRules.default_rule,
                    collection_mode: collectionMode,
                    sampling_rate: samplingRate || 0
                }
            }
            updatePageState({ traceTargetingRules: updatedTraceRules })
        }

        toastPositive('Rule updated successfully')
    }

    const handleDefaultRuleUpdateError = (error: string) => {
        toastNegative('Failed to update rule', error)
    }

    useEffect(() => {
        if (!pageState.filters.ready) {
            return
        }

        router.replace(`?${pageState.filters.serialisedFilters!}`, { scroll: false })

        loadAllRules()
    }, [pageState.filters])

    const eventsDefaultRule = pageState.eventTargetingRules?.default_rule;
    const eventsOverideRules = pageState.eventTargetingRules?.rules ?? [];
    const traceDefaultRule = pageState.traceTargetingRules?.default_rule;
    const traceOverrideRules = pageState.traceTargetingRules?.rules ?? [];
    const sessionTargetingRules = pageState.sessionTargetingRules?.results ?? [];

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <div className="flex flex-row items-center gap-2 justify-between w-full">
                <p className="font-display text-4xl max-w-6xl text-center">Data Control</p>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="font-display border border-black select-none"
                            disabled={
                                pageState.eventTargetingApiStatus !== EventTargetingApiStatus.Success ||
                                pageState.traceTargetingApiStatus !== TraceTargetingApiStatus.Success
                            }
                        >
                            <Plus /> Create Rule
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className='select-none'
                        onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                        <DropdownMenuItem onClick={() => router.push(`/${params.teamId}/data/${pageState.filters.app!.id}/event/create`)}
                            className="font-display">
                            Event Rule
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/${params.teamId}/data/${pageState.filters.app!.id}/trace/create`)}
                            className="font-display">
                            Trace Rule
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/${params.teamId}/data/${pageState.filters.app!.id}/session/create`)}
                            className="font-display">
                            Session Timeline Rule
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
                <p className="text-lg font-display">Error loading rules, please refresh page or select a different app to try again</p>}

            {/* Main data rules UI */}
            {canShowContent() &&
                <div className="flex flex-col items-start w-full">
                    {/* Event Rules Section */}
                    <div className="w-full">
                        <p className="font-display text-2xl">Event Rules</p>
                        <div className="py-4" />

                        {/* Default Event Rule */}
                        <div className="flex items-center gap-2">
                            <p className="font-display text-gray-500">Default Behaviour</p>
                            {eventsDefaultRule && (
                                <button
                                    onClick={() => updatePageState({ editingDefaultRuleType: 'event' })}
                                    className="p-1 hover:bg-yellow-200 rounded"
                                >
                                    <Pencil className="w-4 h-4 text-gray-600" />
                                </button>
                            )}
                        </div>
                        <div className="py-2" />
                        {eventsDefaultRule && (
                            <div className="text-sm font-body text-gray-700">
                                {getCollectionConfigDisplay(eventsDefaultRule.collection_mode, eventsDefaultRule.sampling_rate, 'event')}
                            </div>
                        )}

                        <RulesTable
                            rules={eventsOverideRules}
                            tableType='event'
                            onRuleClick={(rule) => handleEditRule(rule, 'event')}
                        />
                    </div>

                    <div className="py-12" />

                    {/* Trace Rules Section */}
                    <div className="w-full">
                        <p className="font-display text-2xl">Trace Rules</p>
                        <div className="py-4" />

                        {/* Default Trace Rule */}
                        <div className="flex items-center gap-2">
                            <p className="font-display text-gray-500">Default Behaviour</p>
                            {traceDefaultRule && (
                                <button
                                    onClick={() => updatePageState({ editingDefaultRuleType: 'trace' })}
                                    className="p-1 hover:bg-yellow-200 rounded"
                                >
                                    <Pencil className="w-4 h-4 text-gray-600" />
                                </button>
                            )}
                        </div>
                        <div className="py-2" />
                        {traceDefaultRule && (
                            <div className="text-sm font-body text-gray-700">
                                {getCollectionConfigDisplay(traceDefaultRule.collection_mode, traceDefaultRule.sampling_rate, 'trace')}
                            </div>
                        )}

                        <RulesTable
                            rules={traceOverrideRules}
                            tableType='trace'
                            onRuleClick={(rule) => handleEditRule(rule, 'trace')}
                        />
                    </div>

                    <div className="py-12" />

                    {/* Session Timeline Rules Section */}
                    <div className="w-full">
                        <p className="font-display text-2xl">Session Timeline Rules</p>

                        <div className="py-4" />

                        <RulesTable
                            rules={sessionTargetingRules}
                            tableType='session'
                            onRuleClick={(rule) => handleEditRule(rule, 'session')}
                            showOverridesHeader={false}
                        />
                    </div>
                </div>}

            {/* Default Rule Edit Dialog */}
            {pageState.editingDefaultRuleType && eventsDefaultRule && traceDefaultRule && (
                <EditDefaultRuleDialog
                    isOpen={true}
                    onClose={() => updatePageState({ editingDefaultRuleType: null })}
                    onSuccess={handleDefaultRuleUpdateSuccess}
                    onError={handleDefaultRuleUpdateError}
                    ruleType={pageState.editingDefaultRuleType}
                    ruleId={
                        pageState.editingDefaultRuleType === 'event'
                            ? eventsDefaultRule.id
                            : traceDefaultRule.id
                    }
                    appId={pageState.filters.app!.id}
                    condition={
                        pageState.editingDefaultRuleType === 'event'
                            ? eventsDefaultRule.condition
                            : traceDefaultRule.condition
                    }
                    takeScreenshot={
                        pageState.editingDefaultRuleType === 'event'
                            ? eventsDefaultRule.take_screenshot
                            : undefined
                    }
                    takeLayoutSnapshot={
                        pageState.editingDefaultRuleType === 'event'
                            ? eventsDefaultRule.take_layout_snapshot
                            : undefined
                    }
                    initialCollectionMode={
                        pageState.editingDefaultRuleType === 'event'
                            ? eventsDefaultRule.collection_mode
                            : traceDefaultRule.collection_mode
                    }
                    initialSampleRate={
                        pageState.editingDefaultRuleType === 'event'
                            ? eventsDefaultRule.sampling_rate
                            : traceDefaultRule.sampling_rate
                    }
                />
            )}
        </div>
    )
}
