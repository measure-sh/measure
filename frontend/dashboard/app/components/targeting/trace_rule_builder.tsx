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
    deleteTraceTargetingRule,
    DeleteTraceTargetingRuleApiStatus,
} from '@/app/api/api_calls'
import LoadingBar from '@/app/components/loading_bar'
import DangerConfirmationDialog from '@/app/components/danger_confirmation_dialog'
import { toastPositive, toastNegative } from '@/app/utils/use_toast'
import { TraceCondition, AttributeField } from '@/app/utils/cel/conditions'
import { celToConditions } from '@/app/utils/cel/cel_parser'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import { traceConditionToCel } from '@/app/utils/cel/cel_generator'
import RuleBuilderAttributeRow from '@/app/components/targeting/rule_builder_attribute_row'
import SamplingRateInput from '@/app/components/targeting/sampling_rate_input'

interface TraceRuleBuilderProps {
    mode: 'create' | 'edit'
    appId: string
    ruleId?: string
    onCancel: () => void
    onSave: () => void
}

interface TraceRuleState {
    condition: TraceCondition
    collectionMode: 'sampled' | 'session_timeline' | 'disabled'
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
    onSave: onSave,
}: TraceRuleBuilderProps) {
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
    const [deleteConfirmationModalOpen, setDeleteConfirmationModalOpen] = useState(false)
    const [deleteApiStatus, setDeleteApiStatus] = useState(DeleteTraceTargetingRuleApiStatus.Init)

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
                collectionMode: 'session_timeline',
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
            attrs: [],
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

    const getAvailableAttrKeys = (attrType: 'attrs' | 'ud_attrs' | 'session_attrs'): string[] => {
        if (!pageState.configData) return []

        const config = pageState.configData.result || (pageState.configData as any)
        const currentSpanName = pageState.currentRuleState?.condition.spanName

        if (attrType === 'attrs') {
            const traceConfig = config?.trace_config?.find(t => t.name === currentSpanName)
            return traceConfig?.attrs?.map((attr: any) => attr.key) || []
        } else if (attrType === 'ud_attrs') {
            return config?.trace_ud_attrs?.map((attr: any) => attr.key) || []
        } else {
            return config?.session_attrs?.map((attr: any) => attr.key) || []
        }
    }

    const getCombinedAttrKeys = (): string[] => {
        const sessionKeys = getAvailableAttrKeys('session_attrs')
        const udKeys = getAvailableAttrKeys('ud_attrs')
        return [...sessionKeys, ...udKeys]
    }

    const getOperatorsForType = (operatorTypesMapping: any, type: string): string[] => {
        return operatorTypesMapping?.[type] || ['eq', 'neq']
    }

    const getAttrConfigByKey = (key: string, attrType: 'attrs' | 'ud_attrs' | 'session_attrs') => {
        if (!pageState.configData) return null

        const config = pageState.configData.result || (pageState.configData as any)
        const currentSpanName = pageState.currentRuleState?.condition.spanName

        if (attrType === 'attrs') {
            const traceConfig = config?.trace_config?.find(t => t.name === currentSpanName)
            return traceConfig?.attrs?.find((attr: any) => attr.key === key)
        } else if (attrType === 'ud_attrs') {
            return config?.trace_ud_attrs?.find((attr: any) => attr.key === key)
        } else {
            return config?.session_attrs?.find((attr: any) => attr.key === key)
        }
    }

    const handleSpanNameChange = (newSpanName: string) => {
        if (!pageState.configData) return

        // Handle both nested and flat response structures
        const config = pageState.configData.result || (pageState.configData as any)
        if (!config?.trace_config) return

        const traceConfig = config.trace_config.find(t => t.name === newSpanName)
        if (!traceConfig) return

        // Pre-populate trace attrs (rendered by default)
        const attrs = (traceConfig.attrs || []).map((attr, idx) => ({
            id: `${baseId}-attr-${idx}`,
            key: attr.key,
            type: attr.type,
            value: attr.type === 'bool' ? false : attr.type === 'number' ? 0 : '',
            hint: attr.hint,
            operator: 'eq'
        }))

        // Start with empty arrays for ud_attrs and session_attrs (added on demand)
        const newCondition: TraceCondition = {
            id: `${baseId}-condition`,
            spanName: newSpanName,
            operator: 'eq',
            attrs,
            ud_attrs: [],
            session_attrs: []
        }

        updateRuleState({ condition: newCondition })
    }

    const handleAddAttribute = (attrType: 'ud_attrs' | 'session_attrs') => {
        if (!pageState.currentRuleState) return

        const availableKeys = attrType === 'ud_attrs'
            ? getAvailableAttrKeys('ud_attrs')
            : getAvailableAttrKeys('session_attrs')

        if (availableKeys.length === 0) return

        const firstKey = availableKeys[0]
        const attrConfig = getAttrConfigByKey(firstKey, attrType)

        const newAttr: AttributeField = {
            id: `${baseId}-${attrType}-${Date.now()}`,
            key: firstKey,
            type: attrConfig?.type || 'string',
            value: attrConfig?.type === 'bool' ? false : attrConfig?.type === 'number' ? 0 : '',
            hint: attrConfig?.hint,
            operator: 'eq'
        }

        const updatedCondition = {
            ...pageState.currentRuleState.condition,
            [attrType]: [...pageState.currentRuleState.condition[attrType], newAttr]
        }

        updateRuleState({ condition: updatedCondition })
    }

    const handleUpdateAttr = (
        conditionId: string,
        attrId: string,
        field: 'key' | 'type' | 'value' | 'operator',
        value: any,
        attrType: 'attrs' | 'ud_attrs' | 'session_attrs'
    ) => {
        if (!pageState.currentRuleState) return

        const attrs = pageState.currentRuleState.condition[attrType]
        const attrIndex = attrs.findIndex(a => a.id === attrId)
        if (attrIndex === -1) return

        const updatedAttrs = [...attrs]
        const updatedAttr = { ...updatedAttrs[attrIndex] }

        if (field === 'key') {
            // When key changes, update type and reset value
            const attrConfig = getAttrConfigByKey(value, attrType)
            updatedAttr.key = value
            updatedAttr.type = attrConfig?.type || 'string'
            updatedAttr.value = attrConfig?.type === 'bool' ? false : attrConfig?.type === 'number' ? 0 : ''
            updatedAttr.hint = attrConfig?.hint
        } else {
            updatedAttr[field] = value
        }

        updatedAttrs[attrIndex] = updatedAttr

        const updatedCondition = {
            ...pageState.currentRuleState.condition,
            [attrType]: updatedAttrs
        }

        updateRuleState({ condition: updatedCondition })
    }

    const handleRemoveAttr = (
        conditionId: string,
        attrId: string,
        attrType: 'attrs' | 'ud_attrs' | 'session_attrs'
    ) => {
        if (!pageState.currentRuleState) return

        const updatedAttrs = pageState.currentRuleState.condition[attrType].filter(a => a.id !== attrId)

        const updatedCondition = {
            ...pageState.currentRuleState.condition,
            [attrType]: updatedAttrs
        }

        updateRuleState({ condition: updatedCondition })
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

    const handleDeleteRule = async () => {
        if (!ruleId) return

        setDeleteApiStatus(DeleteTraceTargetingRuleApiStatus.Loading)

        try {
            const result = await deleteTraceTargetingRule(appId, ruleId)
            if (result.status === DeleteTraceTargetingRuleApiStatus.Success) {
                setDeleteApiStatus(DeleteTraceTargetingRuleApiStatus.Success)
                toastPositive('Trace rule deleted successfully')
                onSave()
            } else {
                setDeleteApiStatus(DeleteTraceTargetingRuleApiStatus.Error)
                toastNegative('Failed to delete trace rule', result.error || 'Unknown error')
            }
        } catch (error) {
            setDeleteApiStatus(DeleteTraceTargetingRuleApiStatus.Error)
            toastNegative('An error occurred', 'Please try again')
        }
    }

    const hasFilterAttributes = () => {
        return (pageState.currentRuleState?.condition?.ud_attrs?.length ?? 0) > 0 ||
            (pageState.currentRuleState?.condition?.session_attrs?.length ?? 0) > 0
    }

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            {/* Delete Confirmation Dialog */}
            <DangerConfirmationDialog
                body={<p className="font-body">Are you sure you want to delete this trace rule? This action cannot be undone.</p>}
                open={deleteConfirmationModalOpen}
                affirmativeText="Delete Rule"
                cancelText="Cancel"
                onAffirmativeAction={() => {
                    setDeleteConfirmationModalOpen(false)
                    handleDeleteRule()
                }}
                onCancelAction={() => setDeleteConfirmationModalOpen(false)}
            />

            <div className="flex flex-row items-center justify-between w-full">
                <p className="font-display text-4xl max-w-6xl">{getTitle()}</p>
                {mode === 'edit' && (
                    <Button
                        variant="destructive"
                        onClick={() => setDeleteConfirmationModalOpen(true)}
                        className="font-display"
                        disabled={deleteApiStatus === DeleteTraceTargetingRuleApiStatus.Loading}
                        loading={deleteApiStatus === DeleteTraceTargetingRuleApiStatus.Loading}
                    >
                        Delete Rule
                    </Button>
                )}
            </div>
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

                        {/* Trace Attributes Section - Always shown if trace has attrs */}
                        {pageState.currentRuleState?.condition.attrs && pageState.currentRuleState.condition.attrs.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {pageState.currentRuleState.condition.attrs.map(attr => (
                                    <RuleBuilderAttributeRow
                                        key={attr.id}
                                        attr={attr}
                                        conditionId={pageState.currentRuleState!.condition.id}
                                        attrType="attrs"
                                        attrKeys={getAvailableAttrKeys('attrs')}
                                        operatorTypesMapping={(() => {
                                            const config = pageState.configData?.result || (pageState.configData as any)
                                            return config?.operator_types || {}
                                        })()}
                                        getOperatorsForType={getOperatorsForType}
                                        onUpdateAttr={handleUpdateAttr}
                                        showDeleteButton={false}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Add Filter Button - Only shown if trace has ud_attrs capability */}
                        {(() => {
                            const config = pageState.configData?.result || (pageState.configData as any)
                            const currentSpanName = pageState.currentRuleState?.condition.spanName
                            const traceConfig = config?.trace_config?.find((t: any) => t.name === currentSpanName)
                            const hasUdAttrs = traceConfig?.has_ud_attrs
                            const hasCombinedAttrs = hasFilterAttributes()

                            return hasUdAttrs && !hasCombinedAttrs && (
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        // Add first session attr if available, otherwise first ud attr
                                        const sessionKeys = getAvailableAttrKeys('session_attrs')
                                        if (sessionKeys.length > 0) {
                                            handleAddAttribute('session_attrs')
                                        } else {
                                            handleAddAttribute('ud_attrs')
                                        }
                                    }}
                                    className="text-sm font-body px-2 py-1 h-auto -ml-2 mt-2 hover:bg-yellow-200 focus:bg-yellow-200"
                                >
                                    + Filter by attribute
                                </Button>
                            )
                        })()}

                        {/* User-Defined & Session Attributes Section */}
                        {hasFilterAttributes() && (() => {
                            const condition = pageState.currentRuleState!.condition
                            return (
                                <div className="mt-3 space-y-2">
                                    {/* Render session attrs */}
                                    {condition.session_attrs.map(attr => (
                                        <RuleBuilderAttributeRow
                                            key={attr.id}
                                            attr={attr}
                                            conditionId={condition.id}
                                            attrType="session_attrs"
                                            attrKeys={getCombinedAttrKeys()}
                                            operatorTypesMapping={(() => {
                                                const config = pageState.configData?.result || (pageState.configData as any)
                                                return config?.operator_types || {}
                                            })()}
                                            getOperatorsForType={getOperatorsForType}
                                            onUpdateAttr={handleUpdateAttr}
                                            onRemoveAttr={handleRemoveAttr}
                                            showDeleteButton={true}
                                        />
                                    ))}
                                    {/* Render ud attrs */}
                                    {condition.ud_attrs.map(attr => (
                                        <RuleBuilderAttributeRow
                                            key={attr.id}
                                            attr={attr}
                                            conditionId={condition.id}
                                            attrType="ud_attrs"
                                            attrKeys={getCombinedAttrKeys()}
                                            operatorTypesMapping={(() => {
                                                const config = pageState.configData?.result || (pageState.configData as any)
                                                return config?.operator_types || {}
                                            })()}
                                            getOperatorsForType={getOperatorsForType}
                                            onUpdateAttr={handleUpdateAttr}
                                            onRemoveAttr={handleRemoveAttr}
                                            showDeleteButton={true}
                                        />
                                    ))}
                                    {/* Add more attributes button */}
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            // Add first session attr if available, otherwise first ud attr
                                            const sessionKeys = getAvailableAttrKeys('session_attrs')
                                            if (sessionKeys.length > 0) {
                                                handleAddAttribute('session_attrs')
                                            } else {
                                                handleAddAttribute('ud_attrs')
                                            }
                                        }}
                                        className="text-sm font-body px-2 py-1 h-auto -ml-2 mt-1 hover:bg-yellow-200 focus:bg-yellow-200"
                                    >
                                        + Filter by attribute
                                    </Button>
                                </div>
                            )
                        })()}
                    </div>

                    <div className='py-4' />

                    {/* Then section */}
                    <div className="mb-6">
                        <p className="font-display text-xl mb-4">Then</p>

                        {/* Collection config */}
                        <div className="mb-4">
                            <p className="font-display text-gray-500 mb-3">Collection</p>
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
                                    <SamplingRateInput
                                        value={pageState.currentRuleState?.sampleRate || 100}
                                        onChange={(value) => updateRuleState({ sampleRate: value })}
                                        disabled={pageState.currentRuleState?.collectionMode !== 'sampled'}
                                        type="traces"
                                    />
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer h-10">
                                    <input
                                        type="radio"
                                        name="collectionMode"
                                        value="timeline"
                                        checked={pageState.currentRuleState?.collectionMode === 'session_timeline'}
                                        onChange={() => updateRuleState({ collectionMode: 'session_timeline' })}
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