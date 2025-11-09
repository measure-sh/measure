"use client"

import { Button } from '@/app/components/button'
import { useEffect, useState, useId } from 'react'
import { useRouter } from 'next/navigation'
import {
    TraceTargetingRuleApiStatus,
    TraceTargetingConfigApiStatus,
    TraceTargetingRule,
    TraceTargetingConfigResponse,
    fetchTraceTargetingRuleFromServer,
    fetchTraceTargetingConfigFromServer,
    createTraceTargetingRule,
    updateTraceTargetingRule,
    CreateTraceTargetingRuleApiStatus,
    UpdateTraceTargetingRuleApiStatus,
} from '@/app/api/api_calls'
import LoadingBar from '@/app/components/loading_bar'
import { toastPositive, toastNegative } from '@/app/utils/use_toast'
import { TraceCondition } from '@/app/utils/cel/conditions'
import { celToConditions } from '@/app/utils/cel/cel_parser'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import { traceConditionToCel } from '@/app/utils/cel/cel_generator'

interface TraceRuleBuilderProps {
    mode: 'create' | 'edit'
    appId: string
    ruleId?: string
    onCancel: () => void
    onPrimaryAction: () => void
}

interface TraceRuleState {
    condition: TraceCondition
    collectionMode: 'sampled' | 'timeline' | 'disabled'
    sampleRate: number
}

type PageState = {
    ruleData: TraceTargetingRule | null
    configData: TraceTargetingConfigResponse | null
    ruleApiStatus: TraceTargetingRuleApiStatus
    configApiStatus: TraceTargetingConfigApiStatus
    initialRuleState: TraceRuleState | null
    currentRuleState: TraceRuleState | null
    isSaving: boolean
}

export default function TraceRuleBuilder({
    mode,
    appId,
    ruleId,
    onCancel,
    onPrimaryAction: onSave,
}: TraceRuleBuilderProps) {
    const router = useRouter()
    const baseId = useId()
    const [pageState, setPageState] = useState<PageState>({
        ruleData: null,
        configData: null,
        ruleApiStatus: TraceTargetingRuleApiStatus.Loading,
        configApiStatus: TraceTargetingConfigApiStatus.Loading,
        initialRuleState: null,
        currentRuleState: null,
        isSaving: false
    })

    useEffect(() => {
        fetchPageData()
    }, [mode, ruleId, appId])

    const fetchPageData = async () => {
        setPageState(prev => ({
            ...prev,
            ruleApiStatus: TraceTargetingRuleApiStatus.Loading,
            configApiStatus: TraceTargetingConfigApiStatus.Loading
        }))

        const configResult = await fetchTraceTargetingConfigFromServer(appId)
        if (configResult.status === TraceTargetingConfigApiStatus.Error) {
            setPageState(prev => ({
                ...prev,
                configApiStatus: TraceTargetingConfigApiStatus.Error
            }))
            return
        }

        // Fetch rule data if in edit mode
        let ruleData: TraceTargetingRule | null = null
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

        const initialState = convertToTraceRuleState(ruleData, configResult.data, baseId)

        setPageState({
            ruleData,
            configData: configResult.data,
            ruleApiStatus,
            configApiStatus: TraceTargetingConfigApiStatus.Success,
            initialRuleState: initialState,
            currentRuleState: initialState,
            isSaving: false
        })
    }

    const convertToTraceRuleState = (ruleData: TraceTargetingRule | null, configData: TraceTargetingConfigResponse, idPrefix: string): TraceRuleState => {
        if (ruleData) {
            const parsedConditions = celToConditions(ruleData.condition)
            const traceCondition = parsedConditions.trace?.conditions[0] || createDefaultTraceCondition(configData, idPrefix)

            return {
                condition: traceCondition,
                collectionMode: ruleData.collection_mode,
                sampleRate: ruleData.sampling_rate
            }
        } else {
            return {
                condition: createDefaultTraceCondition(configData, idPrefix),
                collectionMode: 'timeline',
                sampleRate: 0
            }
        }
    }

    const createDefaultTraceCondition = (configData: TraceTargetingConfigResponse, idPrefix: string): TraceCondition => {
        const config = (configData as any)
        const firstTraceConfig = config?.trace_config?.[0]

        return {
            id: `${idPrefix}-condition`,
            spanName: firstTraceConfig?.name || '',
            operator: 'eq',
            ud_attrs: [],
            session_attrs: [],
        }
    }

    const getTitle = () => {
        if (mode === 'create') {
            return 'Create Trace Rule'
        }
        return 'Edit Trace Rule'
    }

    const getPrimaryActionLabel = () => {
        return mode === 'create' ? 'Create Rule' : 'Save Changes'
    }

    const isLoading = () => {
        return pageState.ruleApiStatus === TraceTargetingRuleApiStatus.Loading ||
               pageState.configApiStatus === TraceTargetingConfigApiStatus.Loading
    }

    const hasError = () => {
        return pageState.ruleApiStatus === TraceTargetingRuleApiStatus.Error ||
               pageState.configApiStatus === TraceTargetingConfigApiStatus.Error
    }

    const isReady = () => {
        return pageState.ruleApiStatus === TraceTargetingRuleApiStatus.Success &&
               pageState.configApiStatus === TraceTargetingConfigApiStatus.Success
    }

    const hasChanges = () => {
        if (mode === 'create') return true
        return JSON.stringify(pageState.initialRuleState) !== JSON.stringify(pageState.currentRuleState)
    }

    const updateRuleState = (updates: Partial<TraceRuleState>) => {
        setPageState(prev => ({
            ...prev,
            currentRuleState: prev.currentRuleState ? { ...prev.currentRuleState, ...updates } : null
        }))
    }

    const handleSpanNameChange = (newSpanName: string) => {
        if (!pageState.configData) return

        // Handle both nested and flat response structures
        const config = pageState.configData.result || (pageState.configData as any)
        if (!config?.trace_config) return

        const traceConfig = config.trace_config.find(t => t.name === newSpanName)
        if (!traceConfig) return

        // Create new condition with updated span name
        const ud_attrs = traceConfig.has_ud_attrs
            ? config.trace_ud_attrs.map((attr, idx) => ({
                id: `${baseId}-ud-${idx}`,
                key: attr.key,
                type: attr.type,
                value: attr.type === 'bool' ? false : attr.type === 'number' ? 0 : '',
                hint: attr.hint,
                operator: 'eq'
            }))
            : []

        const session_attrs = traceConfig.has_ud_attrs
            ? config.session_attrs.map((attr, idx) => ({
                id: `${baseId}-session-${idx}`,
                key: attr.key,
                type: attr.type,
                value: attr.type === 'bool' ? false : attr.type === 'number' ? 0 : '',
                hint: attr.hint,
                operator: 'eq'
            }))
            : []

        const newCondition: TraceCondition = {
            id: `${baseId}-condition`,
            spanName: newSpanName,
            operator: 'eq',
            ud_attrs,
            session_attrs
        }

        updateRuleState({ condition: newCondition })
    }

    const handleSaveChanges = async () => {
        if (!pageState.currentRuleState) {
            return
        }

        setPageState(prev => ({ ...prev, isSaving: true }))

        try {
            const currentState = pageState.currentRuleState

            const celCondition = traceConditionToCel(pageState.currentRuleState.condition)
            if (!celCondition) {
                setPageState(prev => ({ ...prev, isSaving: false }))
                return
            }

            const ruleData = {
                condition: celCondition,
                collection_mode: currentState.collectionMode,
                sampling_rate: currentState.sampleRate,
            }

            if (mode === 'create') {
                const result = await createTraceTargetingRule(appId, ruleData)
                if (result.status === CreateTraceTargetingRuleApiStatus.Success) {
                    toastPositive('Trace rule created successfully')
                    onSave()
                } else {
                    toastNegative('Failed to create trace rule', result.error || 'Unknown error')
                }
            } else {
                const result = await updateTraceTargetingRule(appId, ruleId!, ruleData)
                if (result.status === UpdateTraceTargetingRuleApiStatus.Success) {
                    toastPositive('Trace rule updated successfully')
                    onSave()
                } else {
                    toastNegative('Failed to update trace rule', result.error || 'Unknown error')
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
                            <span className="font-display text-xl">When</span>
                            <DropdownSelect
                                type={DropdownSelectType.SingleString}
                                title="Select span name"
                                items={(() => {
                                    const config = pageState.configData?.result || (pageState.configData as any)
                                    return config?.trace_config?.map((t: any) => t.name) || []
                                })()}
                                initialSelected={pageState.currentRuleState?.condition.spanName || ''}
                                onChangeSelected={(selected) => handleSpanNameChange(selected as string)}
                            />
                            <span className="font-display text-xl">span ends</span>
                        </div>
                        <button className="text-sm font-body flex items-center gap-2">
                            + Filter by attribute
                        </button>
                    </div>

                    <div className='py-4' />

                    {/* Then section */}
                    <div className="mb-6">
                        <p className="font-display text-xl mb-4">Then</p>

                        {/* Collection config */}
                        <div className="mb-4">
                            <p className="font-body text-sm text-gray-500 mb-3">Collection</p>
                            <div className="space-y-3 ml-4">
                                <label className="flex items-center gap-3 cursor-pointer h-10">
                                    <input
                                        type="radio"
                                        name="collectionMode"
                                        value="sampled"
                                        checked={pageState.currentRuleState?.collectionMode === 'sampled'}
                                        onChange={() => updateRuleState({ collectionMode: 'sampled' })}
                                        className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                    />
                                    <span className="text-sm font-body">Collect at sampling rate</span>
                                    <input
                                        type="number"
                                        value={pageState.currentRuleState?.sampleRate || 100}
                                        onChange={(e) => updateRuleState({ sampleRate: parseFloat(e.target.value) || 0 })}
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
                                        value="timeline"
                                        checked={pageState.currentRuleState?.collectionMode === 'timeline'}
                                        onChange={() => updateRuleState({ collectionMode: 'timeline' })}
                                        className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                    />
                                    <span className="text-sm font-body">Collect with timeline only</span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer h-10">
                                    <input
                                        type="radio"
                                        name="collectionMode"
                                        value="disabled"
                                        checked={pageState.currentRuleState?.collectionMode === 'disabled'}
                                        onChange={() => updateRuleState({ collectionMode: 'disabled' })}
                                        className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                    />
                                    <span className="text-sm font-body">Do not collect</span>
                                </label>
                            </div>
                        </div>
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
                            onClick={handleSaveChanges}
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
