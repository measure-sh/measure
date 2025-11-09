"use client"

import { Button } from '@/app/components/button'
import { useEffect, useState, useId } from 'react'
import { useRouter } from 'next/navigation'
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
} from '@/app/api/api_calls'
import LoadingBar from '@/app/components/loading_bar'
import { toastPositive, toastNegative } from '@/app/utils/use_toast'
import { EventCondition } from '@/app/utils/cel/conditions'
import { celToConditions } from '@/app/utils/cel/cel_parser'
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select'
import { eventConditionToCel } from '@/app/utils/cel/cel_generator'

interface EventRuleBuilderProps {
    mode: 'create' | 'edit'
    appId: string
    ruleId?: string
    onCancel: () => void
    onSaved: () => void
}

interface EventRuleState {
    condition: EventCondition
    collectionMode: 'sampled' | 'timeline' | 'disabled'
    sampleRate: number
    take_layout_snapshot: boolean
    take_screenshot: boolean
}

type PageState = {
    ruleData: EventTargetingRule | null
    configData: EventTargetingConfigResponse | null
    ruleApiStatus: EventTargetingRuleApiStatus
    configApiStatus: EventTargetingConfigApiStatus
    initialRuleState: EventRuleState | null
    currentRuleState: EventRuleState | null
    isSaving: boolean
}

export default function EventRuleBuilder({
    mode,
    appId,
    ruleId,
    onCancel,
    onSaved: onSave,
}: EventRuleBuilderProps) {
    const router = useRouter()
    const baseId = useId()
    const [pageState, setPageState] = useState<PageState>({
        ruleData: null,
        configData: null,
        ruleApiStatus: EventTargetingRuleApiStatus.Loading,
        configApiStatus: EventTargetingConfigApiStatus.Loading,
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
            ruleApiStatus: EventTargetingRuleApiStatus.Loading,
            configApiStatus: EventTargetingConfigApiStatus.Loading
        }))

        const configResult = await fetchEventTargetingConfigFromServer(appId)
        if (configResult.status === EventTargetingConfigApiStatus.Error) {
            setPageState(prev => ({
                ...prev,
                configApiStatus: EventTargetingConfigApiStatus.Error
            }))
            return
        }

        // Fetch rule data if in edit mode
        let ruleData: EventTargetingRule | null = null
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

        const initialState = convertToEventRuleState(ruleData, configResult.data, baseId)

        setPageState({
            ruleData,
            configData: configResult.data,
            ruleApiStatus,
            configApiStatus: EventTargetingConfigApiStatus.Success,
            initialRuleState: initialState,
            currentRuleState: initialState,
            isSaving: false
        })
    }

    const convertToEventRuleState = (ruleData: EventTargetingRule | null, configData: EventTargetingConfigResponse, idPrefix: string): EventRuleState => {
        if (ruleData) {
            const parsedConditions = celToConditions(ruleData.condition)
            const eventCondition = parsedConditions.event?.conditions[0] || createDefaultEventCondition(configData, idPrefix)

            return {
                condition: eventCondition,
                collectionMode: ruleData.collection_mode,
                sampleRate: ruleData.sampling_rate,
                take_layout_snapshot: ruleData.take_layout_snapshot,
                take_screenshot: ruleData.take_screenshot
            }
        } else {
            return {
                condition: createDefaultEventCondition(configData, idPrefix),
                collectionMode: 'timeline',
                sampleRate: 0,
                take_layout_snapshot: false,
                take_screenshot: false
            }
        }
    }

    const createDefaultEventCondition = (configData: EventTargetingConfigResponse, idPrefix: string): EventCondition => {
        const config = (configData as any)
        const firstEventConfig = config.events[0]

        return {
            id: `${idPrefix}-condition`,
            type: firstEventConfig.type,
            attrs: [],
            ud_attrs: [],
            session_attrs: [],
        }
    }

    const getTitle = () => {
        if (mode === 'create') {
            return 'Create Event Rule'
        }
        return 'Edit Event Rule'
    }

    const getPrimaryActionLabel = () => {
        return mode === 'create' ? 'Create Rule' : 'Save Changes'
    }

    const isLoading = () => {
        return pageState.ruleApiStatus === EventTargetingRuleApiStatus.Loading ||
               pageState.configApiStatus === EventTargetingConfigApiStatus.Loading
    }

    const hasError = () => {
        return pageState.ruleApiStatus === EventTargetingRuleApiStatus.Error ||
               pageState.configApiStatus === EventTargetingConfigApiStatus.Error
    }

    const isReady = () => {
        return pageState.ruleApiStatus === EventTargetingRuleApiStatus.Success &&
               pageState.configApiStatus === EventTargetingConfigApiStatus.Success
    }

    const hasChanges = () => {
        if (mode === 'create') return true
        return JSON.stringify(pageState.initialRuleState) !== JSON.stringify(pageState.currentRuleState)
    }

    const updateRuleState = (updates: Partial<EventRuleState>) => {
        setPageState(prev => ({
            ...prev,
            currentRuleState: prev.currentRuleState ? { ...prev.currentRuleState, ...updates } : null
        }))
    }

    const handleEventTypeChange = (newEventType: string) => {
        if (!pageState.configData) return

        // Handle both nested and flat response structures
        const config = pageState.configData.result || (pageState.configData as any)
        if (!config?.events) return

        const eventConfig = config.events.find(e => e.type === newEventType)
        if (!eventConfig) return

        // Create new condition with updated event type and attrs
        const attrs = (eventConfig.attrs || []).map((attr, idx) => ({
            id: `${baseId}-attr-${idx}`,
            key: attr.key,
            type: attr.type,
            value: attr.type === 'bool' ? false : attr.type === 'number' ? 0 : '',
            hint: attr.hint,
            operator: 'eq'
        }))

        const ud_attrs = eventConfig.has_ud_attrs
            ? config.event_ud_attrs.map((attr, idx) => ({
                id: `${baseId}-ud-${idx}`,
                key: attr.key,
                type: attr.type,
                value: attr.type === 'bool' ? false : attr.type === 'number' ? 0 : '',
                hint: attr.hint,
                operator: 'eq'
            }))
            : []

        const session_attrs = eventConfig.has_ud_attrs
            ? config.session_attrs.map((attr, idx) => ({
                id: `${baseId}-session-${idx}`,
                key: attr.key,
                type: attr.type,
                value: attr.type === 'bool' ? false : attr.type === 'number' ? 0 : '',
                hint: attr.hint,
                operator: 'eq'
            }))
            : []

        const newCondition: EventCondition = {
            id: `${baseId}-condition`,
            type: newEventType,
            attrs,
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

            const celCondition = eventConditionToCel(pageState.currentRuleState.condition)
            if (!celCondition) {
                setPageState(prev => ({ ...prev, isSaving: false }))
                return
            }

            const ruleData = {
                condition: celCondition,
                collection_mode: currentState.collectionMode,
                sampling_rate: currentState.sampleRate,
                take_screenshot: currentState.take_screenshot,
                take_layout_snapshot: currentState.take_layout_snapshot,
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
                                title="Select event type"
                                items={(() => {
                                    const config = pageState.configData?.result || (pageState.configData as any)
                                    return config?.events?.map((e: any) => e.type) || []
                                })()}
                                initialSelected={pageState.currentRuleState?.condition.type || ''}
                                onChangeSelected={(selected) => handleEventTypeChange(selected as string)}
                            />
                            <span className="font-display text-xl">event occurs</span>
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

                        {/* Attachments */}
                        <div className="mb-4">
                            <p className="font-body text-sm text-gray-500 mb-3">Attachments</p>
                            <div className="space-y-3 ml-4">
                                <label className="flex items-center gap-3 cursor-pointer h-10">
                                    <input
                                        type="radio"
                                        name="attachmentMode"
                                        value="layout_snapshot"
                                        checked={pageState.currentRuleState?.take_layout_snapshot === true && pageState.currentRuleState?.take_screenshot === false}
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
                                        checked={pageState.currentRuleState?.take_screenshot === true && pageState.currentRuleState?.take_layout_snapshot === false}
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
                                        checked={pageState.currentRuleState?.take_screenshot === false && pageState.currentRuleState?.take_layout_snapshot === false}
                                        onChange={() => updateRuleState({ take_screenshot: false, take_layout_snapshot: false })}
                                        className="appearance-none w-4 h-4 border border-gray-400 rounded-full checked:bg-black checked:border-black cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 flex-shrink-0"
                                    />
                                    <span className="text-sm font-body">No attachments</span>
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
