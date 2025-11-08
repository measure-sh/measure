"use client"

import { Button } from '@/app/components/button'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    EventTargetingRuleApiStatus,
    TraceTargetingRuleApiStatus,
    EventTargetingConfigApiStatus,
    TraceTargetingConfigApiStatus,
    EventTargetingRule,
    TraceTargetingRule,
    EventTargetingConfigResponse,
    TraceTargetingConfigResponse,
    fetchEventTargetingRuleFromServer,
    fetchTraceTargetingRuleFromServer,
    fetchEventTargetingConfigFromServer,
    fetchTraceTargetingConfigFromServer,
    createEventTargetingRule,
    createTraceTargetingRule,
    updateEventTargetingRule,
    updateTraceTargetingRule,
    CreateEventTargetingRuleApiStatus,
    CreateTraceTargetingRuleApiStatus,
    UpdateEventTargetingRuleApiStatus,
    UpdateTraceTargetingRuleApiStatus,
} from '@/app/api/api_calls'
import LoadingBar from '@/app/components/loading_bar'
import { toastPositive, toastNegative } from '@/app/utils/use_toast'

interface EventTraceRuleBuilderProps {
    type: 'event' | 'trace'
    mode: 'create' | 'edit'
    appId: string
    ruleId?: string
    onCancel: () => void
    onPrimaryAction: () => void
}

type PageState = {
    ruleData: EventTargetingRule | TraceTargetingRule | null
    configData: EventTargetingConfigResponse | TraceTargetingConfigResponse | null
    ruleApiStatus: EventTargetingRuleApiStatus | TraceTargetingRuleApiStatus
    configApiStatus: EventTargetingConfigApiStatus | TraceTargetingConfigApiStatus
    initialRuleState: string | null
    currentRuleState: string | null
    isSaving: boolean
}

type FormState = {
    collectionMode: 'sample_rate' | 'timeline_only' | 'disable'
    sampleRate: number
    attachmentMode: 'layout_snapshot' | 'screenshot' | 'none'
}

export default function EventTraceRuleBuilder({
    type,
    mode,
    appId,
    ruleId,
    onCancel,
    onPrimaryAction,
}: EventTraceRuleBuilderProps) {
    const router = useRouter()
    const [pageState, setPageState] = useState<PageState>({
        ruleData: null,
        configData: null,
        ruleApiStatus: EventTargetingRuleApiStatus.Loading,
        configApiStatus: EventTargetingConfigApiStatus.Loading,
        initialRuleState: null,
        currentRuleState: null,
        isSaving: false
    })

    const [formState, setFormState] = useState<FormState>({
        collectionMode: 'sample_rate',
        sampleRate: 100,
        attachmentMode: 'none'
    })

    useEffect(() => {
        fetchPageData()
    }, [mode, ruleId, appId, type])

    const fetchPageData = async () => {
        setPageState(prev => ({
            ...prev,
            ruleApiStatus: EventTargetingRuleApiStatus.Loading,
            configApiStatus: EventTargetingConfigApiStatus.Loading
        }))

        if (type === 'event') {
            const configResult = await fetchEventTargetingConfigFromServer(appId)
            if (configResult.status === EventTargetingConfigApiStatus.Error) {
                setPageState(prev => ({
                    ...prev,
                    configApiStatus: EventTargetingConfigApiStatus.Error
                }))
                return
            }

            // Fetch rule data if in edit mode
            let ruleData = null
            let ruleApiStatus = EventTargetingRuleApiStatus.Success
            if (mode === 'edit' && ruleId) {
                const ruleResult = await fetchEventTargetingRuleFromServer(appId, ruleId)
                if (ruleResult.status === EventTargetingRuleApiStatus.Error) {
                    setPageState(prev => ({
                        ...prev,
                        ruleApiStatus: EventTargetingRuleApiStatus.Error,
                        configApiStatus: EventTargetingConfigApiStatus.Success,
                        configData: configResult.data
                    }))
                    return
                }
                ruleData = ruleResult.data
            }

            const initialFormState = {
                collectionMode: 'sample_rate' as const,
                sampleRate: 100,
                attachmentMode: 'none' as const
            }
            setFormState(initialFormState)
            const initialState = JSON.stringify(initialFormState)
            setPageState({
                ruleData,
                configData: configResult.data,
                ruleApiStatus,
                configApiStatus: EventTargetingConfigApiStatus.Success,
                initialRuleState: initialState,
                currentRuleState: initialState
            })
        } else {
            const configResult = await fetchTraceTargetingConfigFromServer(appId)
            if (configResult.status === TraceTargetingConfigApiStatus.Error) {
                setPageState(prev => ({
                    ...prev,
                    configApiStatus: TraceTargetingConfigApiStatus.Error
                }))
                return
            }

            // Fetch rule data if in edit mode
            let ruleData = null
            let ruleApiStatus = TraceTargetingRuleApiStatus.Success
            if (mode === 'edit' && ruleId) {
                const ruleResult = await fetchTraceTargetingRuleFromServer(appId, ruleId)
                if (ruleResult.status === TraceTargetingRuleApiStatus.Error) {
                    setPageState(prev => ({
                        ...prev,
                        ruleApiStatus: TraceTargetingRuleApiStatus.Error,
                        configApiStatus: TraceTargetingConfigApiStatus.Success,
                        configData: configResult.data
                    }))
                    return
                }
                ruleData = ruleResult.data
            }

            const initialFormState = {
                collectionMode: 'sample_rate' as const,
                sampleRate: 100,
                attachmentMode: 'none' as const
            }
            setFormState(initialFormState)
            const initialState = JSON.stringify(initialFormState)
            setPageState({
                ruleData,
                configData: ruleData,
                ruleApiStatus,
                configApiStatus: TraceTargetingConfigApiStatus.Success,
                initialRuleState: initialState,
                currentRuleState: initialState
            })
        }
    }

    const getTitle = () => {
        const typeLabel = type === 'event' ? 'Event' : 'Trace'
        if (mode === 'create') {
            return `Create ${typeLabel} Rule`
        }
        return `Edit ${typeLabel} Rule`
    }

    const getPrimaryActionLabel = () => {
        return mode === 'create' ? 'Create Rule' : 'Save Changes'
    }

    const isLoading = () => {
        return pageState.ruleApiStatus === EventTargetingRuleApiStatus.Loading ||
               pageState.ruleApiStatus === TraceTargetingRuleApiStatus.Loading ||
               pageState.configApiStatus === EventTargetingConfigApiStatus.Loading ||
               pageState.configApiStatus === TraceTargetingConfigApiStatus.Loading
    }

    const hasError = () => {
        return pageState.ruleApiStatus === EventTargetingRuleApiStatus.Error ||
               pageState.ruleApiStatus === TraceTargetingRuleApiStatus.Error ||
               pageState.configApiStatus === EventTargetingConfigApiStatus.Error ||
               pageState.configApiStatus === TraceTargetingConfigApiStatus.Error
    }

    const isReady = () => {
        return (pageState.ruleApiStatus === EventTargetingRuleApiStatus.Success ||
                pageState.ruleApiStatus === TraceTargetingRuleApiStatus.Success) &&
               (pageState.configApiStatus === EventTargetingConfigApiStatus.Success ||
                pageState.configApiStatus === TraceTargetingConfigApiStatus.Success)
    }

    const hasChanges = () => {
        if (mode === 'create') return true
        return pageState.initialRuleState !== pageState.currentRuleState
    }

    const updateFormState = (updates: Partial<FormState>) => {
        const newFormState = { ...formState, ...updates }
        setFormState(newFormState)
        setPageState(prev => ({
            ...prev,
            currentRuleState: JSON.stringify(newFormState)
        }))
    }

    const handlePrimaryAction = async () => {
        setPageState(prev => ({ ...prev, isSaving: true }))

        try {
            // Build collection config
            const collectionConfig = formState.collectionMode === 'sample_rate'
                ? { mode: 'sample_rate' as const, sample_rate: formState.sampleRate }
                : formState.collectionMode === 'timeline_only'
                    ? { mode: 'timeline_only' as const }
                    : { mode: 'disable' as const }

            if (type === 'event') {
                // Build event rule request
                const ruleData = {
                    rule: mode === 'edit' && pageState.ruleData ? pageState.ruleData.rule : 'event_type == "click"',
                    collection_config: collectionConfig,
                    take_screenshot: formState.attachmentMode === 'screenshot',
                    take_layout_snapshot: formState.attachmentMode === 'layout_snapshot',
                }

                if (mode === 'create') {
                    const result = await createEventTargetingRule(appId, ruleData)
                    if (result.status === CreateEventTargetingRuleApiStatus.Success) {
                        toastPositive('Event rule created successfully')
                        onPrimaryAction()
                    } else {
                        toastNegative('Failed to create event rule', result.error || 'Unknown error')
                    }
                } else {
                    const result = await updateEventTargetingRule(appId, ruleId!, ruleData)
                    if (result.status === UpdateEventTargetingRuleApiStatus.Success) {
                        toastPositive('Event rule updated successfully')
                        onPrimaryAction()
                    } else {
                        toastNegative('Failed to update event rule', result.error || 'Unknown error')
                    }
                }
            } else {
                // Build trace rule request
                const ruleData = {
                    rule: mode === 'edit' && pageState.ruleData ? pageState.ruleData.rule : 'trace_name == "root"',
                    collection_config: collectionConfig,
                }

                if (mode === 'create') {
                    const result = await createTraceTargetingRule(appId, ruleData)
                    if (result.status === CreateTraceTargetingRuleApiStatus.Success) {
                        toastPositive('Trace rule created successfully')
                        onPrimaryAction()
                    } else {
                        toastNegative('Failed to create trace rule', result.error || 'Unknown error')
                    }
                } else {
                    const result = await updateTraceTargetingRule(appId, ruleId!, ruleData)
                    if (result.status === UpdateTraceTargetingRuleApiStatus.Success) {
                        toastPositive('Trace rule updated successfully')
                        onPrimaryAction()
                    } else {
                        toastNegative('Failed to update trace rule', result.error || 'Unknown error')
                    }
                }
            }
        } catch (error) {
            toastNegative('An error occurred', 'Please try again')
        } finally {
            setPageState(prev => ({ ...prev, isSaving: false }))
        }
    }

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <p className="font-display text-4xl max-w-6xl text-center">{getTitle()}</p>
            <div className="py-4" />

            {/* Loading indicator */}
            <div className={`py-1 w-full ${isLoading() ? 'visible' : 'invisible'}`}>
                <LoadingBar />
            </div>

            {/* Error state */}
            {hasError() && (
                <div className="w-full flex flex-col items-center">
                    <p className="text-normal font-body">
                        Error loading rule. Please try again or go back.
                    </p>
                    <div className="py-4" />
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        className="font-display border border-black select-none"
                    >
                        Go Back
                    </Button>
                </div>
            )}

            {/* Main content */}
            {isReady() && (
                <div className="w-full flex flex-col">
                    {/* When section */}
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="font-display text-lg">When</span>
                            <div className="flex-1 px-4 py-2 border border-gray-300 rounded-md bg-gray-50">
                                <code className="text-sm font-mono">
                                    {mode === 'edit' && pageState.ruleData
                                        ? pageState.ruleData.rule
                                        : 'event_type == "click"'}
                                </code>
                            </div>
                        </div>
                        <button className="text-sm font-body text-gray-600 flex items-center gap-2 ml-14">
                            + Filter by attribute
                        </button>
                    </div>

                    {/* Then section */}
                    <div className="mb-6">
                        <p className="font-display text-lg mb-4">Then</p>

                        {/* Collection config */}
                        <div className="mb-4">
                            <p className="font-body text-sm text-gray-500 mb-3">Collection</p>
                            <div className="space-y-3 ml-4">
                                <label className="flex items-center gap-3 cursor-pointer h-10">
                                    <input
                                        type="radio"
                                        name="collectionMode"
                                        value="sample_rate"
                                        checked={formState.collectionMode === 'sample_rate'}
                                        onChange={() => updateFormState({ collectionMode: 'sample_rate' })}
                                        className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                    />
                                    <span className="text-sm font-body">Collect at sampling rate</span>
                                    <input
                                        type="number"
                                        value={formState.sampleRate}
                                        onChange={(e) => updateFormState({ sampleRate: parseFloat(e.target.value) || 0 })}
                                        min="0"
                                        max="100"
                                        step="0.000001"
                                        className="w-32 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body"
                                    />
                                    <span className="text-sm font-body">%</span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer h-10">
                                    <input
                                        type="radio"
                                        name="collectionMode"
                                        value="timeline_only"
                                        checked={formState.collectionMode === 'timeline_only'}
                                        onChange={() => updateFormState({ collectionMode: 'timeline_only' })}
                                        className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                    />
                                    <span className="text-sm font-body">Collect with timeline only</span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer h-10">
                                    <input
                                        type="radio"
                                        name="collectionMode"
                                        value="disable"
                                        checked={formState.collectionMode === 'disable'}
                                        onChange={() => updateFormState({ collectionMode: 'disable' })}
                                        className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                    />
                                    <span className="text-sm font-body">Never collect</span>
                                </label>
                            </div>
                        </div>

                        {/* Attachments (only for events) */}
                        {type === 'event' && (
                            <div className="mb-4">
                                <p className="font-body text-sm text-gray-500 mb-3">Attachments</p>
                                <div className="space-y-3 ml-4">
                                    <label className="flex items-center gap-3 cursor-pointer h-10">
                                        <input
                                            type="radio"
                                            name="attachmentMode"
                                            value="layout_snapshot"
                                            checked={formState.attachmentMode === 'layout_snapshot'}
                                            onChange={() => updateFormState({ attachmentMode: 'layout_snapshot' })}
                                            className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                        />
                                        <span className="text-sm font-body">Take layout snapshot</span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer h-10">
                                        <input
                                            type="radio"
                                            name="attachmentMode"
                                            value="screenshot"
                                            checked={formState.attachmentMode === 'screenshot'}
                                            onChange={() => updateFormState({ attachmentMode: 'screenshot' })}
                                            className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                        />
                                        <span className="text-sm font-body">Take screenshot</span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer h-10">
                                        <input
                                            type="radio"
                                            name="attachmentMode"
                                            value="none"
                                            checked={formState.attachmentMode === 'none'}
                                            onChange={() => updateFormState({ attachmentMode: 'none' })}
                                            className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                        />
                                        <span className="text-sm font-body">No attachments</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            className="font-display"
                            disabled={pageState.isSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handlePrimaryAction}
                            className="font-display border border-black"
                            disabled={!hasChanges()}
                            loading={pageState.isSaving}
                        >
                            {getPrimaryActionLabel()}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
