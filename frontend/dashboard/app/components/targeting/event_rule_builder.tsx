"use client"

import { Button } from '@/app/components/button'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    EventTargetingRuleApiStatus,
    EventTargetingConfigApiStatus,
    EventTargetingRule,
    EventTargetingConfigResponse,
    fetchEventTargetingRuleFromServer,
    fetchEventTargetingConfigFromServer,
    createEventTargetingRule,
    updateEventTargetingRule,
    CreateEventTargetingRuleApiStatus,
    UpdateEventTargetingRuleApiStatus,
    deleteEventTargetingRule,
    DeleteEventTargetingRuleApiStatus,
} from '@/app/api/api_calls'
import LoadingBar from '@/app/components/loading_bar'
import DangerConfirmationDialog from '@/app/components/danger_confirmation_dialog'
import { toastPositive, toastNegative } from '@/app/utils/use_toast'
import { EventCondition, AttributeField } from '@/app/utils/cel/conditions'
import { celToConditions } from '@/app/utils/cel/cel_parser'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import { eventConditionToCel } from '@/app/utils/cel/cel_generator'
import RuleBuilderAttributeRow from '@/app/components/targeting/rule_builder_attribute_row'
import SamplingRateInput from '@/app/components/targeting/sampling_rate_input'
import DeleteRule from './delete_rule'

interface EventRuleBuilderProps {
    mode: 'create' | 'edit'
    appId: string
    ruleId?: string
    onCancel: () => void
    onSave: () => void
    onDelete: () => void
}

interface EventRuleState {
    condition: EventCondition
    collectionMode: 'sampled' | 'session_timeline' | 'disabled'
    sampleRate: number
    take_layout_snapshot: boolean
    take_screenshot: boolean
}

export default function EventRuleBuilder({
    mode,
    appId,
    ruleId,
    onCancel,
    onSave,
    onDelete,
}: EventRuleBuilderProps) {

    const [apiState, setApiState] = useState({
        ruleStatus: EventTargetingRuleApiStatus.Loading,
        configStatus: EventTargetingConfigApiStatus.Loading,
        ruleData: null as EventTargetingRule | null,
        config: null as EventTargetingConfigResponse | null,
    })
    const [uiState, setUiState] = useState({
        showDeleteDialog: false,
        isSubmitting: false,
        isDeleting: false,
    })
    const [ruleState, setRuleState] = useState<EventRuleState | null>(null)
    const [initialRuleState, setInitialRuleState] = useState<EventRuleState | null>(null)


    const convertToEventRuleState = useCallback(
        (ruleData: EventTargetingRule | null, configData: EventTargetingConfigResponse): EventRuleState => {
            if (ruleData) {
                const parsed = celToConditions(ruleData.condition)
                const eventCondition = parsed.event?.conditions[0] || createDefaultEventCondition(configData)
                return {
                    condition: eventCondition,
                    collectionMode: ruleData.collection_mode,
                    sampleRate: ruleData.sampling_rate,
                    take_layout_snapshot: ruleData.take_layout_snapshot,
                    take_screenshot: ruleData.take_screenshot,
                }
            } else {
                return {
                    condition: createDefaultEventCondition(configData),
                    collectionMode: 'session_timeline',
                    sampleRate: 0,
                    take_layout_snapshot: false,
                    take_screenshot: false,
                }
            }
        },
        []
    )

    const createDefaultEventCondition = (config: EventTargetingConfigResponse): EventCondition => {
        const firstEventConfig = config.events[0]
        return {
            id: `${crypto.randomUUID()}`,
            type: firstEventConfig.type,
            attrs: [],
            ud_attrs: [],
            session_attrs: [],
        }
    }

    const fetchPageData = useCallback(async () => {
        setApiState(prev => ({
            ...prev,
            ruleStatus: EventTargetingRuleApiStatus.Loading,
            configStatus: EventTargetingConfigApiStatus.Loading,
        }))

        try {
            const configPromise = fetchEventTargetingConfigFromServer(appId)
            const rulePromise = mode === 'edit' && ruleId
                ? fetchEventTargetingRuleFromServer(appId, ruleId)
                : Promise.resolve(null)

            const [configResult, ruleResult] = await Promise.all([configPromise, rulePromise])

            if (configResult.status === EventTargetingConfigApiStatus.Error) {
                setApiState(prev => ({ ...prev, configStatus: EventTargetingConfigApiStatus.Error }))
                return
            }

            let ruleData: EventTargetingRule | null = null
            let ruleApiStatus = EventTargetingRuleApiStatus.Success

            if (mode === 'edit' && ruleResult) {
                if (ruleResult.status === EventTargetingRuleApiStatus.Error) {
                    setApiState({
                        ruleStatus: EventTargetingRuleApiStatus.Error,
                        configStatus: EventTargetingConfigApiStatus.Success,
                        ruleData: null,
                        config: configResult.data,
                    })
                    return
                } else {
                    ruleData = ruleResult.data
                }
            }

            const initial = convertToEventRuleState(ruleData, configResult.data)

            setApiState({
                ruleStatus: ruleApiStatus,
                configStatus: EventTargetingConfigApiStatus.Success,
                ruleData,
                config: configResult.data,
            })
            setInitialRuleState(initial)
            setRuleState(initial)
            setUiState(prev => ({ ...prev, showDeleteDialog: false }))
        } catch (err) {
            setApiState(prev => ({
                ...prev,
                ruleStatus: EventTargetingRuleApiStatus.Error,
                configStatus: EventTargetingConfigApiStatus.Error,
            }))
        }
    }, [appId, mode, ruleId, convertToEventRuleState])

    useEffect(() => {
        fetchPageData()
    }, [fetchPageData])


    const isLoading = useMemo(() => {
        return apiState.ruleStatus === EventTargetingRuleApiStatus.Loading ||
            apiState.configStatus === EventTargetingConfigApiStatus.Loading
    }, [apiState.ruleStatus, apiState.configStatus])

    const hasError = useMemo(() => {
        return apiState.ruleStatus === EventTargetingRuleApiStatus.Error ||
            apiState.configStatus === EventTargetingConfigApiStatus.Error
    }, [apiState.ruleStatus, apiState.configStatus])

    const eventTypes = useMemo(() => {
        return apiState.config?.events?.map(e => e.type) ?? []
    }, [apiState.config])

    const hasChanges = useCallback(() => {
        if (mode === 'create') return true
        return JSON.stringify(initialRuleState) !== JSON.stringify(ruleState)
    }, [mode, initialRuleState, ruleState])


    const updateRuleState = useCallback((updates: Partial<EventRuleState>) => {
        setRuleState(prev => (prev ? { ...prev, ...updates } : prev))
    }, [])

    const getAvailableAttrKeys = useCallback((attrType: 'attrs' | 'ud_attrs' | 'session_attrs'): string[] => {
        if (!apiState.config || !ruleState) return []
        const currentEventType = ruleState.condition.type
        if (attrType === 'attrs') {
            const eventConfig = apiState.config.events?.find(e => e.type === currentEventType)
            return eventConfig?.attrs?.map((a) => a.key) ?? []
        } else if (attrType === 'ud_attrs') {
            return apiState.config?.event_ud_attrs?.map((a) => a.key) ?? []
        } else {
            return apiState.config?.session_attrs?.map((a) => a.key) ?? []
        }
    }, [apiState.config, ruleState])

    const getCombinedAttrKeys = useCallback(() => {
        const sessionKeys = getAvailableAttrKeys('session_attrs')
        const udKeys = getAvailableAttrKeys('ud_attrs')
        return [...sessionKeys, ...udKeys]
    }, [getAvailableAttrKeys])

    const getOperatorsForType = useCallback((operatorMapping: Record<string, string[]>, type: string): string[] => {
        return operatorMapping?.[type] || []
    }, [])

    const getAttrConfigByKey = useCallback((key: string, attrType: 'attrs' | 'ud_attrs' | 'session_attrs') => {
        if (!apiState.config || !ruleState) return null
        const currentEventType = ruleState.condition.type
        if (attrType === 'attrs') {
            const eventConfig = apiState.config.events?.find(e => e.type === currentEventType)
            return eventConfig?.attrs?.find((a) => a.key === key) ?? null
        } else if (attrType === 'ud_attrs') {
            return apiState.config.event_ud_attrs?.find((a) => a.key === key) ?? null
        } else {
            return apiState.config.session_attrs?.find((a) => a.key === key) ?? null
        }
    }, [apiState.config, ruleState])

    const handleAddAttribute = useCallback((attrType: 'ud_attrs' | 'session_attrs') => {
        if (!ruleState) return
        const availableKeys = attrType === 'ud_attrs' ? getAvailableAttrKeys('ud_attrs') : getAvailableAttrKeys('session_attrs')
        if (availableKeys.length === 0) return
        const firstKey = availableKeys[0]
        const attrConfig = getAttrConfigByKey(firstKey, attrType)

        const newAttr: AttributeField = {
            id: `${crypto.randomUUID()}`,
            key: firstKey,
            type: attrConfig?.type || 'string',
            value: attrConfig?.type === 'bool' ? false : attrConfig?.type === 'number' ? 0 : '',
            hint: attrConfig?.hint,
            operator: 'eq',
        }

        const updatedCondition = {
            ...ruleState.condition,
            [attrType]: [...ruleState.condition[attrType], newAttr],
        }

        updateRuleState({ condition: updatedCondition })
    }, [ruleState, getAvailableAttrKeys, getAttrConfigByKey, updateRuleState])

    const handleUpdateAttr = useCallback((
        _conditionId: string,
        attrId: string,
        field: 'key' | 'type' | 'value' | 'operator',
        value: any,
        attrType: 'attrs' | 'ud_attrs' | 'session_attrs'
    ) => {
        if (!ruleState) return
        const attrs = ruleState.condition[attrType]
        const idx = attrs.findIndex(a => a.id === attrId)
        if (idx === -1) return
        const updatedAttrs = [...attrs]
        const updatedAttr = { ...updatedAttrs[idx] }

        if (field === 'key') {
            const attrConfig = getAttrConfigByKey(value, attrType)
            updatedAttr.key = value
            updatedAttr.type = attrConfig?.type || 'string'
            updatedAttr.value = attrConfig?.type === 'bool' ? false : attrConfig?.type === 'number' ? 0 : ''
            updatedAttr.hint = attrConfig?.hint
        } else {
            updatedAttr[field] = value
        }

        updatedAttrs[idx] = updatedAttr
        const updatedCondition = { ...ruleState.condition, [attrType]: updatedAttrs }
        updateRuleState({ condition: updatedCondition })
    }, [ruleState, getAttrConfigByKey, updateRuleState])

    const handleRemoveAttr = useCallback((
        _conditionId: string,
        attrId: string,
        attrType: 'attrs' | 'ud_attrs' | 'session_attrs'
    ) => {
        if (!ruleState) return
        const updatedAttrs = ruleState.condition[attrType].filter(a => a.id !== attrId)
        const updatedCondition = { ...ruleState.condition, [attrType]: updatedAttrs }
        updateRuleState({ condition: updatedCondition })
    }, [ruleState, updateRuleState])

    const handleEventTypeChange = useCallback((newEventType: string) => {
        if (!apiState.config) return
        const eventConfig = apiState.config.events?.find(e => e.type === newEventType)
        if (!eventConfig) return

        const attrs = (eventConfig.attrs || []).map((attr) => ({
            id: `${crypto.randomUUID()}`,
            key: attr.key,
            type: attr.type,
            value: attr.type === 'bool' ? false : attr.type === 'number' ? 0 : '',
            hint: attr.hint,
            operator: 'eq',
        }))

        const newCondition: EventCondition = {
            id: `${crypto.randomUUID()}`,
            type: newEventType,
            attrs,
            ud_attrs: [],
            session_attrs: [],
        }

        updateRuleState({ condition: newCondition })
    }, [apiState.config, updateRuleState])

    const hasFilterAttributes = useCallback(() => {
        return (ruleState?.condition?.ud_attrs?.length ?? 0) > 0 || (ruleState?.condition?.session_attrs?.length ?? 0) > 0
    }, [ruleState])


    const handleSaveChanges = useCallback(async () => {
        if (!ruleState) return
        setUiState(prev => ({ ...prev, isSubmitting: true }))

        try {
            const celCondition = eventConditionToCel(ruleState.condition)
            if (!celCondition) {
                setUiState(prev => ({ ...prev, isSubmitting: false }))
                return
            }

            const ruleData = {
                condition: celCondition,
                collection_mode: ruleState.collectionMode,
                sampling_rate: ruleState.sampleRate,
                take_screenshot: ruleState.take_screenshot,
                take_layout_snapshot: ruleState.take_layout_snapshot,
            }

            if (mode === 'create') {
                const result = await createEventTargetingRule(appId, ruleData)
                if (result.status === CreateEventTargetingRuleApiStatus.Success) {
                    toastPositive('Event rule created successfully')
                    onSave()
                } else {
                    toastNegative('Failed to create event rule', result.error || 'Unknown error')
                }
            } else {
                const result = await updateEventTargetingRule(appId, ruleId!, ruleData)
                if (result.status === UpdateEventTargetingRuleApiStatus.Success) {
                    toastPositive('Event rule updated successfully')
                    onSave()
                } else {
                    toastNegative('Failed to update event rule', result.error || 'Unknown error')
                }
            }
        } catch (err) {
            toastNegative('An error occurred', 'Please try again')
        } finally {
            setUiState(prev => ({ ...prev, isSubmitting: false }))
        }
    }, [ruleState, mode, appId, ruleId, onSave])

    const openDeleteDialog = useCallback(() => {
        setUiState(prev => ({ ...prev, showDeleteDialog: true }))
    }, [])

    const closeDeleteDialog = useCallback(() => {
        setUiState(prev => ({ ...prev, showDeleteDialog: false }))
    }, [])

    const handleDeleteRule = useCallback(async () => {
        if (!ruleId) return
        setUiState(prev => ({ ...prev, showDeleteDialog: false, isDeleting: true }))
        try {
            const result = await deleteEventTargetingRule(appId, ruleId)
            if (result.status === DeleteEventTargetingRuleApiStatus.Success) {
                toastPositive('Event rule deleted successfully')
                onDelete()
            } else {
                toastNegative('Failed to delete event rule, please try again later')
            }
        } catch (err) {
            toastNegative('An error occurred', 'Please try again')
        } finally {
            setUiState(prev => ({ ...prev, isDeleting: false }))
        }
    }, [appId, ruleId, onDelete])


    if (isLoading) {
        return (
            <div className="flex flex-col selection:bg-yellow-200/75 items-start">
                <div className="flex flex-row items-center justify-between w-full">
                    <p className="font-display text-4xl max-w-6xl">{mode === 'create' ? 'Create Event Rule' : 'Edit Event Rule'}</p>
                </div>
                <div className="py-4" />
                <div className="py-1 w-full visible">
                    <LoadingBar />
                </div>
            </div>
        )
    }

    if (hasError) {
        return (
            <div className="flex flex-col selection:bg-yellow-200/75 items-start">
                <div className="flex flex-row items-center justify-between w-full">
                    <p className="font-display text-4xl max-w-6xl">{mode === 'create' ? 'Create Event Rule' : 'Edit Event Rule'}</p>
                </div>
                <div className="py-4" />
                <div className="w-full flex flex-col items-center">
                    <p className="text-normal font-body">Error loading rule. Please try again or go back.</p>
                    <div className="py-4" />
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={fetchPageData} className="font-display border border-black">Retry</Button>
                        <Button variant="outline" onClick={onCancel} className="font-display border border-black">Go Back</Button>
                    </div>
                </div>
            </div>
        )
    }

    function RuleConfigurationSection() {
        return (
            <div className="w-full flex flex-col">
                {/* When */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="font-display text-xl">When</span>

                        <DropdownSelect
                            type={DropdownSelectType.SingleString}
                            title="Select event type"
                            items={eventTypes}
                            initialSelected={ruleState?.condition.type || ''}
                            onChangeSelected={(selected) => handleEventTypeChange(selected as string)}
                        />

                        <span className="font-display text-xl">event occurs</span>
                    </div>

                    {/* Event Attributes */}
                    {ruleState?.condition.attrs && ruleState.condition.attrs.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {ruleState.condition.attrs.map(attr => (
                                <RuleBuilderAttributeRow
                                    key={attr.id}
                                    attr={attr}
                                    conditionId={ruleState.condition.id}
                                    attrType="attrs"
                                    attrKeys={getAvailableAttrKeys('attrs')}
                                    operatorTypesMapping={apiState.config?.operator_types}
                                    getOperatorsForType={getOperatorsForType}
                                    onUpdateAttr={handleUpdateAttr}
                                    showDeleteButton={false}
                                />
                            ))}
                        </div>
                    )}

                    {/* Add Filter CTA (only show if event supports ud_attrs and no filters yet) */}
                    {(() => {
                        const currentEventType = ruleState?.condition.type
                        const eventConfig = apiState.config?.events?.find(e => e.type === currentEventType)
                        const hasUdAttrs = !!eventConfig?.has_ud_attrs
                        const hasCombinedAttrs = hasFilterAttributes()
                        if (hasUdAttrs && !hasCombinedAttrs) {
                            return (
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        const sessionKeys = getAvailableAttrKeys('session_attrs')
                                        if (sessionKeys.length > 0) handleAddAttribute('session_attrs')
                                        else handleAddAttribute('ud_attrs')
                                    }}
                                    className="text-sm font-body px-2 py-1 h-auto -ml-2 mt-2 hover:bg-yellow-200 focus:bg-yellow-200"
                                >
                                    + Filter by attribute
                                </Button>
                            )
                        }
                        return null
                    })()}

                    {/* Session & UD attrs (if any) */}
                    {hasFilterAttributes() && (() => {
                        const condition = ruleState!.condition
                        return (
                            <div className="mt-3 space-y-2">
                                {condition.session_attrs.map(attr => (
                                    <RuleBuilderAttributeRow
                                        key={attr.id}
                                        attr={attr}
                                        conditionId={condition.id}
                                        attrType="attrs"
                                        attrKeys={getCombinedAttrKeys()}
                                        operatorTypesMapping={apiState.config?.operator_types}
                                        getOperatorsForType={getOperatorsForType}
                                        onUpdateAttr={handleUpdateAttr}
                                        onRemoveAttr={handleRemoveAttr}
                                        showDeleteButton={true}
                                    />
                                ))}
                                {condition.ud_attrs.map(attr => (
                                    <RuleBuilderAttributeRow
                                        key={attr.id}
                                        attr={attr}
                                        conditionId={condition.id}
                                        attrType="ud_attrs"
                                        attrKeys={getCombinedAttrKeys()}
                                        operatorTypesMapping={apiState.config?.operator_types}
                                        getOperatorsForType={getOperatorsForType}
                                        onUpdateAttr={handleUpdateAttr}
                                        onRemoveAttr={handleRemoveAttr}
                                        showDeleteButton={true}
                                    />
                                ))}
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        const sessionKeys = getAvailableAttrKeys('session_attrs')
                                        if (sessionKeys.length > 0) handleAddAttribute('session_attrs')
                                        else handleAddAttribute('ud_attrs')
                                    }}
                                    className="text-sm font-body px-2 py-1 h-auto -ml-2 mt-1 hover:bg-yellow-200 focus:bg-yellow-200"
                                >
                                    + Filter by attribute
                                </Button>
                            </div>
                        )
                    })()}
                </div>

                <div className="py-4" />

                {/* Then */}
                <div className="mb-6">
                    <p className="font-display text-xl mb-4">Then</p>

                    {/* Collection */}
                    <div className="mb-4">
                        <p className="font-display text-gray-500 mb-3">Collection</p>
                        <div className="space-y-3 ml-4">
                            <label className="flex items-center gap-3 cursor-pointer h-10">
                                <input
                                    type="radio"
                                    name="collectionMode"
                                    value="sampled"
                                    checked={ruleState?.collectionMode === 'sampled'}
                                    onChange={() => updateRuleState({ collectionMode: 'sampled' })}
                                    className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                />
                                <SamplingRateInput
                                    value={ruleState?.sampleRate || 100}
                                    onChange={(value) => updateRuleState({ sampleRate: value })}
                                    disabled={ruleState?.collectionMode !== 'sampled'}
                                    type="events"
                                />
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer h-10">
                                <input
                                    type="radio"
                                    name="collectionMode"
                                    value="session_timeline"
                                    checked={ruleState?.collectionMode === 'session_timeline'}
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
                                    checked={ruleState?.collectionMode === 'disabled'}
                                    onChange={() => updateRuleState({ collectionMode: 'disabled' })}
                                    className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                />
                                <span className="text-sm font-body">Do not collect</span>
                            </label>
                        </div>
                    </div>

                    {/* Attachments */}
                    <div className="mb-4">
                        <p className="font-display text-gray-500 mb-3">Attachments</p>
                        <div className="space-y-3 ml-4">
                            <label className="flex items-center gap-3 cursor-pointer h-10">
                                <input
                                    type="radio"
                                    name="attachmentMode"
                                    value="layout_snapshot"
                                    checked={ruleState?.take_layout_snapshot === true && ruleState?.take_screenshot === false}
                                    onChange={() => updateRuleState({ take_layout_snapshot: true, take_screenshot: false })}
                                    className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                />
                                <span className="text-sm font-body">Take layout snapshot</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer h-10">
                                <input
                                    type="radio"
                                    name="attachmentMode"
                                    value="screenshot"
                                    checked={ruleState?.take_screenshot === true && ruleState?.take_layout_snapshot === false}
                                    onChange={() => updateRuleState({ take_screenshot: true, take_layout_snapshot: false })}
                                    className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                />
                                <span className="text-sm font-body">Take screenshot</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer h-10">
                                <input
                                    type="radio"
                                    name="attachmentMode"
                                    value="none"
                                    checked={ruleState?.take_screenshot === false && ruleState?.take_layout_snapshot === false}
                                    onChange={() => updateRuleState({ take_screenshot: false, take_layout_snapshot: false })}
                                    className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                />
                                <span className="text-sm font-body">No attachments</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        )
    }


    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <DeleteRule
                open={uiState.showDeleteDialog}
                onConfirm={handleDeleteRule}
                onCancel={closeDeleteDialog}
                isDeleting={uiState.isDeleting}
            />

            <div className="flex flex-row items-center justify-between w-full">
                <p className="font-display text-4xl max-w-6xl">{mode === 'create' ? 'Create Event Rule' : 'Edit Event Rule'}</p>
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveChanges}
                    className="font-display border border-black"
                    disabled={!hasChanges()}
                    loading={uiState.isSubmitting}
                >
                    {mode === 'create' ? 'Publish Rule' : 'Save Changes'}
                </Button>
            </div>

            <div className="py-4" />

            <RuleConfigurationSection />

            {mode === 'edit' ? (
                <div className="w-full flex justify-center">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={openDeleteDialog}
                        className="font-display text-red-600 hover:text-white hover:bg-red-600"
                    >
                        Delete Rule
                    </Button>
                </div>
            ) : <div />}
        </div>
    )
}
