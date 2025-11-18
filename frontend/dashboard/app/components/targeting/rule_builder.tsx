"use client"

import { createEventTargetingRule, CreateEventTargetingRuleApiStatus, createTraceTargetingRule, CreateTraceTargetingRuleApiStatus, EventTargetingConfigResponse, EventTargetingRule, fetchEventTargetingConfigFromServer, fetchEventTargetingRuleFromServer, fetchTraceTargetingConfigFromServer, fetchTraceTargetingRuleFromServer, TraceTargetingConfigResponse, TraceTargetingRule, updateEventTargetingRule, UpdateEventTargetingRuleApiStatus, updateTraceTargetingRule, UpdateTraceTargetingRuleApiStatus, EventTargetingConfig, TraceTargetingConfig, DeleteEventTargetingRuleApiStatus, deleteEventTargetingRule, deleteTraceTargetingRule, DeleteTraceTargetingRuleApiStatus, CollectionMode, fetchSessionTargetingConfigFromServer, fetchSessionTargetingRuleFromServer, SessionTargetingConfigResponse, SessionTargetingRule, deleteSessionTargetingRule, DeleteSessionTargetingRuleApiStatus, createSessionTargetingRule, CreateSessionTargetingRuleApiStatus, updateSessionTargetingRule, UpdateSessionTargetingRuleApiStatus, AttributeTargetingConfig } from "@/app/api/api_calls"
import { conditionsToCel } from "@/app/utils/cel/cel_generator"
import { celToConditions, ParsedConditions } from "@/app/utils/cel/cel_parser"
import { AttributeField, BaseAttributeField, EventCondition, TraceCondition } from "@/app/utils/cel/conditions"
import { toastNegative, toastPositive } from "@/app/utils/use_toast"
import { useEffect, useState } from "react"
import { Button } from "../button"
import DropdownSelect, { DropdownSelectType } from "../dropdown_select"
import LoadingSpinner from "../loading_spinner"
import SamplingRateInput from "./sampling_rate_input"
import DangerConfirmationDialog from "../danger_confirmation_dialog"
import AttributeBuilder from "./attribute_builder"
import { Plus } from "lucide-react"
import TraceOperatorNameInput from "./trace_name_operator_input"

enum PageState {
    Loading,
    Error,
    Success
}

interface RuleBuilderProps {
    type: 'event' | 'trace' | 'timeline'
    mode: 'create' | 'edit'
    appId: string
    ruleId?: string
    onCancel: () => void
    onSave: () => void
    onDelete: () => void
}

interface RuleState {
    name: string,
    conditionType: 'event' | 'trace',
    condition: {
        id: string
        eventType?: string
        spanName?: string
        spanOperator?: string
        attributes: AttributeField[]
    }
    collectionMode: CollectionMode
    sampleRate: number
    take_layout_snapshot?: boolean
    take_screenshot?: boolean
}

export default function RuleBuilder({
    type,
    mode,
    appId,
    ruleId,
    onCancel,
    onSave,
    onDelete,
}: RuleBuilderProps) {
    const [uiState, setUiState] = useState({
        showDeleteDialog: false,
        pageState: PageState.Loading,
        saving: false,
        deleting: false,
        ruleNameError: false,
    })

    const [ruleState, setRuleState] = useState<RuleState | null>(null)
    const [initialRuleState, setInitialRuleState] = useState<RuleState | null>(null)
    const [config, setConfig] = useState<EventTargetingConfigResponse | TraceTargetingConfigResponse | TraceTargetingConfigResponse | null>(null)

    const createEmptyEventRuleState = (config: EventTargetingConfigResponse): RuleState | null => {
        const firstEvent = config.events[0]

        if (!firstEvent) {
            return null
        }

        const type = firstEvent.type

        return {
            name: '',
            collectionMode: 'timeline',
            condition: {
                id: crypto.randomUUID(),
                eventType: type,
                attributes: []
            },
            conditionType: 'event',
            sampleRate: 100,
            take_layout_snapshot: false,
            take_screenshot: false,
        }
    }

    const getAttributeWithSuggestions = (
        key: string,
        source: 'fixed' | 'session' | 'ud',
        baseAttr: BaseAttributeField,
        config: EventTargetingConfigResponse | TraceTargetingConfigResponse | SessionTargetingConfigResponse,
        eventType?: string
    ): AttributeField => {
        let attrConfig: AttributeTargetingConfig | undefined

        if (source === 'fixed') {
            if ('events' in config) {
                const eventDef = config.events.find(e => 'type' in e && e.type === eventType)
                attrConfig = eventDef?.attrs?.find(a => a.key === key)
            }
        } else if (source === 'session') {
            attrConfig = config.session_attrs?.find(a => a.key === key)
        } else if (source === 'ud') {
            if ('event_ud_attrs' in config) {
                attrConfig = config.event_ud_attrs?.find(a => a.key === key)
            } else if ('trace_ud_attrs' in config) {
                attrConfig = config.trace_ud_attrs?.find(a => a.key === key)
            }
        }

        return {
            ...baseAttr,
            source,
            suggestions: attrConfig?.suggestions,
            hint: attrConfig?.hint,
        }
    }

    const convertToEventRuleState = (
        ruleData: EventTargetingRule,
        config: EventTargetingConfigResponse
    ): RuleState | null => {
        const parsed = celToConditions(ruleData.condition)
        const eventCondition = parsed.event?.conditions[0]
        if (!eventCondition) {
            console.error("Failed to parse event rule to UI state")
            return null
        }

        const attributes: AttributeField[] = [
            ...(eventCondition.attrs || []).map(attr =>
                getAttributeWithSuggestions(attr.key, 'fixed', attr, config, eventCondition.type)
            ),
            ...(eventCondition.session_attrs || []).map(attr =>
                getAttributeWithSuggestions(attr.key, 'session', attr, config)
            ),
            ...(eventCondition.ud_attrs || []).map(attr =>
                getAttributeWithSuggestions(attr.key, 'ud', attr, config)
            ),
        ]

        return {
            name: ruleData.name,
            collectionMode: ruleData.collection_mode,
            conditionType: 'event',
            condition: {
                id: eventCondition.id,
                eventType: eventCondition.type,
                attributes: attributes
            },
            sampleRate: ruleData.sampling_rate,
            take_layout_snapshot: ruleData.take_layout_snapshot,
            take_screenshot: ruleData.take_screenshot,
        }
    }

    const createEmptyTraceRuleState = (config: TraceTargetingConfigResponse): RuleState | null => {
        return {
            name: '',
            collectionMode: 'timeline',
            conditionType: 'trace',
            condition: {
                id: crypto.randomUUID(),
                spanName: '',
                spanOperator: 'eq',
                attributes: []
            },
            sampleRate: 100,
            take_layout_snapshot: false,
            take_screenshot: false,
        }
    }

    const convertToTraceRuleState = (
        ruleData: TraceTargetingRule,
        config: TraceTargetingConfigResponse
    ): RuleState | null => {
        const parsed = celToConditions(ruleData.condition)
        const traceCondition = parsed.trace?.conditions[0]

        if (!traceCondition) {
            console.error("Failed to parse trace rule to UI state")
            return null
        }

        const attributes: AttributeField[] = [
            ...(traceCondition.ud_attrs || []).map(attr =>
                getAttributeWithSuggestions(attr.key, 'ud', attr, config)
            ),
            ...(traceCondition.session_attrs || []).map(attr =>
                getAttributeWithSuggestions(attr.key, 'session', attr, config)
            ),
        ]

        return {
            name: ruleData.name,
            collectionMode: ruleData.collection_mode,
            conditionType: 'trace',
            condition: {
                id: traceCondition.id,
                spanName: traceCondition.spanName,
                spanOperator: traceCondition.operator || 'eq',
                attributes: attributes
            },
            sampleRate: ruleData.sampling_rate,
        }
    }

    const createEmptyTimelineRuleState = (config: SessionTargetingConfigResponse): RuleState | null => {
        const firstEvent = config.events[0]
        if (!firstEvent || !('type' in firstEvent)) {
            return null
        }

        const eventConfig = firstEvent as EventTargetingConfig

        return {
            name: '',
            condition: {
                id: crypto.randomUUID(),
                eventType: eventConfig.type,
                attributes: [],
            },
            conditionType: 'event',
            collectionMode: 'sampled',
            sampleRate: 100,
        }
    }

    const convertToTimelineRuleState = (
        ruleData: SessionTargetingRule,
        config: SessionTargetingConfigResponse
    ): RuleState | null => {
        const parsed = celToConditions(ruleData.condition)

        if (parsed.event?.conditions[0]) {
            const eventCondition = parsed.event.conditions[0]

            const attributes: AttributeField[] = [
                ...(eventCondition.attrs || []).map(attr =>
                    getAttributeWithSuggestions(attr.key, 'fixed', attr, config, eventCondition.type)
                ),
                ...(eventCondition.session_attrs || []).map(attr =>
                    getAttributeWithSuggestions(attr.key, 'session', attr, config)
                ),
                ...(eventCondition.ud_attrs || []).map(attr =>
                    getAttributeWithSuggestions(attr.key, 'ud', attr, config)
                ),
            ]

            return {
                name: ruleData.name,
                condition: {
                    id: eventCondition.id,
                    eventType: eventCondition.type,
                    attributes: attributes
                },
                collectionMode: 'sampled',
                conditionType: 'event',
                sampleRate: ruleData.sampling_rate,
            }
        }

        if (parsed.trace?.conditions[0]) {
            const traceCondition = parsed.trace.conditions[0]

            const attributes: AttributeField[] = [
                ...(traceCondition.ud_attrs || []).map(attr =>
                    getAttributeWithSuggestions(attr.key, 'ud', attr, config)
                ),
                ...(traceCondition.session_attrs || []).map(attr =>
                    getAttributeWithSuggestions(attr.key, 'session', attr, config)
                ),
            ]

            return {
                name: ruleData.name,
                condition: {
                    id: traceCondition.id,
                    spanName: traceCondition.spanName,
                    attributes: attributes
                },
                conditionType: 'trace',
                collectionMode: 'sampled',
                sampleRate: ruleData.sampling_rate,
            }
        }

        console.error("Failed to parse session timeline rule to UI state")
        return null
    }

    const getOperatorsForType = (type: string) => {
        if (!config) return []

        switch (type) {
            case 'float64':
                return config?.operator_types.float64
            case 'int64':
                return config?.operator_types.int64
            case 'bool':
                return config?.operator_types.bool
            default:
                return config?.operator_types.string
        }
    }

    const getDefaultValue = (type: string): string | number | boolean => {
        if (type === 'bool') return false
        if (type === 'int64' || type === 'float64') return 0
        return ''
    }

    const updateRuleState = (updates: Partial<RuleState>) => {
        setRuleState(prev => (prev ? { ...prev, ...updates } : prev))
    }

    const pageHeading = (() => {
        switch (type) {
            case 'event':
                return mode === 'create' ? 'Create Event Rule' : 'Edit Event Rule'
            case 'trace':
                return mode === 'create' ? 'Create Trace Rule' : 'Edit Trace Rule'
            case 'timeline':
                return mode === 'create' ? 'Create Session Timeline Rule' : 'Edit Session Timeline Rule'
        }
    })()

    const shouldEnableSaveButton = (() => {
        if (uiState.pageState != PageState.Success) {
            return false
        }

        if (mode === 'create') {
            return true
        }

        return JSON.stringify(initialRuleState) !== JSON.stringify(ruleState)
    })()

    const fetchEventPageData = async () => {
        setUiState((prev) => ({
            ...prev,
            pageState: PageState.Loading
        }))

        try {
            const configPromise = fetchEventTargetingConfigFromServer(appId)
            const rulePromise = mode === 'edit' && ruleId
                ? fetchEventTargetingRuleFromServer(appId, ruleId)
                : Promise.resolve(null)

            const [configResult, ruleResult] = await Promise.all([configPromise, rulePromise])

            if (!configResult) {
                setUiState((prev) => ({
                    ...prev,
                    pageState: PageState.Error
                }))
                return
            }

            if (mode === 'edit' && !ruleResult) {
                setUiState((prev) => ({
                    ...prev,
                    pageState: PageState.Error
                }))
                return
            }

            const ruleState = mode === 'edit'
                ? convertToEventRuleState(ruleResult!.data, configResult.data)
                : createEmptyEventRuleState(configResult.data)


            if (!ruleState) {
                setUiState((prev) => ({
                    ...prev,
                    pageState: PageState.Error
                }))
                return
            }

            setConfig(configResult.data)
            setInitialRuleState(ruleState)
            setRuleState(ruleState)
            setUiState((prev) => ({
                ...prev,
                pageState: PageState.Success
            }))
        } catch (err) {
            setUiState((prev) => ({
                ...prev,
                pageState: PageState.Error
            }))
        }
    }

    const fetchTracePageData = async () => {
        setUiState((prev) => ({
            ...prev,
            pageState: PageState.Loading
        }))

        try {
            const configPromise = fetchTraceTargetingConfigFromServer(appId)
            const rulePromise = mode === 'edit' && ruleId
                ? fetchTraceTargetingRuleFromServer(appId, ruleId)
                : Promise.resolve(null)

            const [configResult, ruleResult] = await Promise.all([configPromise, rulePromise])

            if (!configResult) {
                console.log("No config result")
                setUiState((prev) => ({
                    ...prev,
                    pageState: PageState.Error
                }))
                return
            }

            if (mode === 'edit' && !ruleResult) {
                setUiState((prev) => ({
                    ...prev,
                    pageState: PageState.Error
                }))
                return
            }

            const ruleState = mode === 'edit'
                ? convertToTraceRuleState(ruleResult!.data, configResult.data)
                : createEmptyTraceRuleState(configResult.data)


            if (!ruleState) {
                setUiState((prev) => ({
                    ...prev,
                    pageState: PageState.Error
                }))
                return
            }

            setConfig(configResult.data)
            setInitialRuleState(ruleState)
            setRuleState(ruleState)
            setUiState((prev) => ({
                ...prev,
                pageState: PageState.Success
            }))
        } catch (err) {
            console.log(err)
            setUiState((prev) => ({
                ...prev,
                pageState: PageState.Error
            }))
        }
    }

    const fetchTimelinePageData = async () => {
        setUiState((prev) => ({
            ...prev,
            pageState: PageState.Loading
        }))

        try {
            const configPromise = fetchSessionTargetingConfigFromServer(appId)
            const rulePromise = mode === 'edit' && ruleId
                ? fetchSessionTargetingRuleFromServer(appId, ruleId)
                : Promise.resolve(null)

            const [configResult, ruleResult] = await Promise.all([configPromise, rulePromise])

            if (!configResult) {
                console.log("No config result")
                setUiState((prev) => ({
                    ...prev,
                    pageState: PageState.Error
                }))
                return
            }

            if (mode === 'edit' && !ruleResult) {
                setUiState((prev) => ({
                    ...prev,
                    pageState: PageState.Error
                }))
                return
            }

            const ruleState = mode === 'edit'
                ? convertToTimelineRuleState(ruleResult!.data, configResult.data)
                : createEmptyTimelineRuleState(configResult.data)

            if (!ruleState) {
                setUiState((prev) => ({
                    ...prev,
                    pageState: PageState.Error
                }))
                return
            }

            setConfig(configResult.data)
            setInitialRuleState(ruleState)
            setRuleState(ruleState)
            setUiState((prev) => ({
                ...prev,
                pageState: PageState.Success
            }))
        } catch (err) {
            console.log(err)
            setUiState((prev) => ({
                ...prev,
                pageState: PageState.Error
            }))
        }
    }

    const handleSave = async () => {
        if (!ruleState) {
            console.error("Failed to save rule as ruleState was null")
            return
        }

        if (!ruleState.name || ruleState.name.trim() === '') {
            toastNegative("Please enter a rule name")
            setUiState((prev) => ({
                ...prev,
                ruleNameError: true
            }))
            return
        }

        setUiState((prev) => ({
            ...prev,
            saving: true
        }))

        if (type === 'event') {
            const attributes = ruleState.condition.attributes
            const eventCondition: EventCondition = {
                id: ruleState.condition.id,
                type: ruleState.condition.eventType!,
                attrs: attributes.filter(a => a.source === 'fixed'),
                session_attrs: attributes.filter(a => a.source === 'session'),
                ud_attrs: attributes.filter(a => a.source === 'ud'),
            }
            const parsedConditions: ParsedConditions = {
                event: {
                    conditions: [eventCondition],
                    operators: []
                },
            }

            const celConditions = conditionsToCel(parsedConditions)

            if (!celConditions) {
                console.error("Failed to generate CEL from UI state")
                setUiState((prev) => ({
                    ...prev,
                    saving: false
                }))
                return
            }

            const ruleData = {
                name: ruleState.name,
                condition: celConditions,
                collection_mode: ruleState.collectionMode,
                sampling_rate: ruleState.sampleRate,
                take_screenshot: ruleState.take_screenshot ?? false,
                take_layout_snapshot: ruleState.take_layout_snapshot ?? false,
            }

            if (mode === 'edit') {
                const result = await updateEventTargetingRule(appId, ruleId!, ruleData)
                if (result.status === UpdateEventTargetingRuleApiStatus.Success) {
                    toastPositive("Successfully updated rule")
                    onSave()
                } else {
                    toastNegative("Failed to save rule, please try again later")
                }
            } else {
                const result = await createEventTargetingRule(appId, ruleData)
                if (result.status === CreateEventTargetingRuleApiStatus.Success) {
                    toastPositive("Successfully created rule")
                    onSave()
                } else {
                    toastNegative("Failed to save rule, please try again later")
                }
            }
        } else if (type === 'trace') {
            const attributes = ruleState.condition.attributes
            const traceCondition: TraceCondition = {
                id: ruleState.condition.id,
                spanName: ruleState.condition.spanName!,
                operator: ruleState.condition.spanOperator || 'eq',
                ud_attrs: attributes.filter(a => a.source === 'ud'),
                session_attrs: attributes.filter(a => a.source === 'session'),
            }

            const parsedConditions: ParsedConditions = {
                trace: {
                    conditions: [traceCondition],
                    operators: []
                },
            }

            const celConditions = conditionsToCel(parsedConditions)

            if (!celConditions) {
                console.log("Failed to generate CEL from UI state")
                setUiState((prev) => ({
                    ...prev,
                    saving: false
                }))
                return
            }

            const ruleData = {
                name: ruleState.name,
                condition: celConditions,
                collection_mode: ruleState.collectionMode,
                sampling_rate: ruleState.sampleRate,
            }

            if (mode === 'edit') {
                const result = await updateTraceTargetingRule(appId, ruleId!, ruleData)
                if (result.status === UpdateTraceTargetingRuleApiStatus.Success) {
                    toastPositive("Successfully updated rule")
                    onSave()
                } else {
                    toastNegative("Failed to save rule, please try again later")
                }
            } else {
                const result = await createTraceTargetingRule(appId, ruleData)
                if (result.status === CreateTraceTargetingRuleApiStatus.Success) {
                    toastPositive("Successfully created rule")
                    onSave()
                } else {
                    toastNegative("Failed to save rule, please try again later")
                }
            }
        } else if (type === 'timeline') {
            let celConditions: string | null = null

            if (ruleState.conditionType === 'event') {
                const attributes = ruleState.condition.attributes
                const eventCondition: EventCondition = {
                    id: ruleState.condition.id,
                    type: ruleState.condition.eventType!,
                    attrs: attributes.filter(a => a.source === 'fixed'),
                    session_attrs: attributes.filter(a => a.source === 'session'),
                    ud_attrs: attributes.filter(a => a.source === 'ud'),
                }
                const parsedConditions: ParsedConditions = {
                    event: {
                        conditions: [eventCondition],
                        operators: []
                    },
                }
                celConditions = conditionsToCel(parsedConditions)
            } else {
                const attributes = ruleState.condition.attributes
                const traceCondition: TraceCondition = {
                    id: ruleState.condition.id,
                    spanName: ruleState.condition.spanName!,
                    operator: 'eq',
                    ud_attrs: attributes.filter(a => a.source === 'ud'),
                    session_attrs: attributes.filter(a => a.source === 'session'),
                }
                const parsedConditions: ParsedConditions = {
                    trace: {
                        conditions: [traceCondition],
                        operators: []
                    },
                }
                celConditions = conditionsToCel(parsedConditions)
            }

            if (!celConditions) {
                console.error("Failed to generate CEL from UI state")
                setUiState((prev) => ({
                    ...prev,
                    saving: false
                }))
                return
            }

            const ruleData = {
                name: ruleState.name,
                condition: celConditions,
                sampling_rate: ruleState.sampleRate,
            }

            if (mode === 'edit') {
                const result = await updateSessionTargetingRule(appId, ruleId!, ruleData)
                if (result.status === UpdateSessionTargetingRuleApiStatus.Success) {
                    toastPositive("Successfully updated rule")
                    onSave()
                } else {
                    toastNegative("Failed to save rule, please try again later")
                }
            } else {
                const result = await createSessionTargetingRule(appId, ruleData)
                if (result.status === CreateSessionTargetingRuleApiStatus.Success) {
                    toastPositive("Successfully created rule")
                    onSave()
                } else {
                    toastNegative("Failed to save rule, please try again later")
                }
            }
        }

        setUiState((prev) => ({
            ...prev,
            saving: false
        }))
    }

    const handleEventTypeChange = async (type: string) => {
        setRuleState((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                condition: {
                    ...prev.condition,
                    eventType: type,
                    attributes: []
                }
            };
        });
    }

    const handleConditionTypeChange = (newType: 'event' | 'trace') => {
        if (!config) return
        const sessionConfig = config as SessionTargetingConfigResponse

        if (newType === 'event') {
            const firstEvent = sessionConfig.events[0]
            if (!firstEvent || !('type' in firstEvent)) return

            const eventConfig = firstEvent as EventTargetingConfig

            setRuleState((prev) => {
                if (!prev) return prev
                return {
                    ...prev,
                    conditionType: 'event',
                    condition: {
                        id: crypto.randomUUID(),
                        eventType: eventConfig.type,
                        attributes: []
                    }
                }
            })
        } else {
            setRuleState((prev) => {
                if (!prev) return prev
                return {
                    ...prev,
                    conditionType: 'trace',
                    condition: {
                        id: crypto.randomUUID(),
                        spanName: "",
                        attributes: []
                    }
                }
            })
        }
    }

    const handleDeleteRule = async () => {
        if (!ruleId) return
        setUiState(prev => ({ ...prev, showDeleteDialog: false, isDeleting: true }))
        try {

            switch (type) {
                case 'event':
                    const eventResult = await deleteEventTargetingRule(appId, ruleId)
                    if (eventResult.status === DeleteEventTargetingRuleApiStatus.Success) {
                        toastPositive('Event rule deleted successfully')
                        onDelete()
                    } else {
                        toastNegative('Failed to delete event rule, please try again later')
                    }
                    break;
                case 'trace':
                    const traceResult = await deleteTraceTargetingRule(appId, ruleId)
                    if (traceResult.status === DeleteTraceTargetingRuleApiStatus.Success) {
                        toastPositive('Trace rule deleted successfully')
                        onDelete()
                    } else {
                        toastNegative('Failed to delete trace rule, please try again later')
                    }
                case 'timeline':
                    const timelineResult = await deleteSessionTargetingRule(appId, ruleId)
                    if (timelineResult.status === DeleteSessionTargetingRuleApiStatus.Success) {
                        toastPositive('Session timeline rule deleted successfully')
                        onDelete()
                    } else {
                        toastNegative('Failed to delete rule, please try again later')
                    }
            }
        } catch (err) {
            toastNegative('An error occurred', 'Please try again')
        } finally {
            setUiState(prev => ({ ...prev, isDeleting: false }))
        }
    }

    const handleRuleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRuleState((prev) => {
            if (!prev) return null;
            return {
                ...prev,
                name: event.target.value,
            }
        })

        setUiState((prev) => ({
            ...prev,
            ruleNameError: false
        }))
    }

    const closeDeleteDialog = (() => {
        setUiState(prev => ({ ...prev, showDeleteDialog: false }))
    })

    const openDeleteDialog = (() => {
        setUiState(prev => ({ ...prev, showDeleteDialog: true }))
    })

    const addAttribute = () => {
        if (!ruleState || !config) {
            return
        }

        const effectiveType = type === 'timeline' ? ruleState.conditionType : type

        if (effectiveType === 'event') {
            const eventConfig = config as EventTargetingConfigResponse | SessionTargetingConfigResponse
            const eventDef = 'events' in eventConfig
                ? eventConfig.events.find((e) => 'type' in e && e.type === ruleState.condition.eventType) as EventTargetingConfig | undefined
                : undefined
            const attr = eventDef?.attrs?.at(0) ?? eventConfig.session_attrs?.at(0)

            if (!attr) {
                console.error("Failed to add attribute, no attribute found")
                return
            }

            let source: 'fixed' | 'session' | 'ud'
            if (eventDef?.attrs?.some(a => a.key === attr.key)) {
                source = 'fixed'
            } else if (eventConfig.session_attrs?.some(a => a.key === attr.key)) {
                source = 'session'
            } else {
                source = 'ud'
            }

            const newEventAttr: AttributeField & { source: 'fixed' | 'session' | 'ud' } = {
                id: crypto.randomUUID(),
                key: attr.key,
                type: attr.type,
                hint: attr.hint,
                suggestions: attr.suggestions,
                value: getDefaultValue(attr.type),
                operator: getOperatorsForType(attr.type)[0] || 'eq',
                source: source,
            }

            setRuleState((prev) => {
                if (!prev) return prev
                return {
                    ...prev,
                    condition: {
                        ...prev.condition,
                        attributes: [...prev.condition.attributes, newEventAttr]
                    }
                }
            })
        } else {
            const traceConfig = config as TraceTargetingConfigResponse | SessionTargetingConfigResponse
            const traceAttr = traceConfig.session_attrs?.at(0)

            if (!traceAttr) {
                console.error("Failed to add trace attribute, no attribute found")
                return
            }

            const newTraceAttr: AttributeField & { source: 'fixed' | 'session' | 'ud' } = {
                id: crypto.randomUUID(),
                key: traceAttr.key,
                type: traceAttr.type,
                hint: traceAttr.hint,
                suggestions: traceAttr.suggestions,
                value: getDefaultValue(traceAttr.type),
                operator: getOperatorsForType(traceAttr.type)[0] || 'eq',
                source: 'session',
            }

            setRuleState((prev) => {
                if (!prev) return prev
                return {
                    ...prev,
                    condition: {
                        ...prev.condition,
                        attributes: [...prev.condition.attributes, newTraceAttr]
                    }
                }
            })
        }
    }

    const updateAttributeKey = (id: string, newKey: string, newSource: 'fixed' | 'session' | 'ud') => {
        if (!ruleState || !config) return
        let attrDef;
        if (type === 'event') {
            const eventConfig = config as EventTargetingConfigResponse
            const eventDef = eventConfig.events.find(e => e.type === ruleState.condition.eventType)

            if (newSource === 'fixed') {
                attrDef = eventDef?.attrs?.find(a => a.key === newKey)
            } else if (newSource === 'session') {
                attrDef = eventConfig.session_attrs?.find(a => a.key === newKey)
            } else {
                attrDef = eventConfig.event_ud_attrs?.find(a => a.key === newKey)
            }
        } else {
            const traceConfig = config as TraceTargetingConfigResponse
            if (newSource === 'session') {
                attrDef = traceConfig.session_attrs?.find(a => a.key === newKey)
            }
        }

        if (!attrDef) {
            console.error("Failed to find attribute definition for new key")
            return
        }

        setRuleState((prev) => {
            if (!prev) return prev
            return {
                ...prev,
                condition: {
                    ...prev.condition,
                    attributes: prev.condition.attributes.map(attr =>
                        attr.id === id ? {
                            ...attr,
                            key: newKey,
                            source: newSource,
                            type: attrDef.type,
                            hint: attrDef.hint,
                            suggestions: attrDef.suggestions,
                            value: getDefaultValue(attrDef.type),
                            operator: getOperatorsForType(attrDef.type)[0] || 'eq',
                        } : attr
                    )
                }
            }
        })
    }

    const updateAttributeValue = (id: string, newValue: string | number | boolean) => {
        setRuleState((prev) => {
            if (!prev) return prev
            return {
                ...prev,
                condition: {
                    ...prev.condition,
                    attributes: prev.condition.attributes.map(attr =>
                        attr.id === id ? { ...attr, value: newValue } : attr
                    )
                }
            }
        })
    }

    const updateAttributeOperator = (id: string, newOperator: string) => {
        setRuleState((prev) => {
            if (!prev) return prev
            return {
                ...prev,
                condition: {
                    ...prev.condition,
                    attributes: prev.condition.attributes.map(attr =>
                        attr.id === id ? { ...attr, operator: newOperator } : attr
                    )
                }
            }
        })
    }

    const deleteAttribute = (id: string) => {
        setRuleState((prev) => {
            if (!prev) return prev
            return {
                ...prev,
                condition: {
                    ...prev.condition,
                    attributes: prev.condition.attributes.filter(attr => attr.id !== id)
                }
            }
        })
    }

    const renderEventWhen = () => {
        if (!ruleState || !config) return null

        const eventConfig = config as EventTargetingConfigResponse
        const eventTypes = eventConfig.events
            .filter((e): e is EventTargetingConfig => 'type' in e)
            .map(e => e.type)

        return (
            <div className="flex flex-col gap-4">
                <p className="max-w-6xl text-xl font-display">When</p>

                <div className="flex items-center gap-3">
                    <span className="text-base text-gray-600 font-display">Event of type</span>
                    <DropdownSelect
                        type={DropdownSelectType.SingleString}
                        title="Select event type"
                        items={eventTypes}
                        initialSelected={ruleState.condition.eventType ?? ''}
                        onChangeSelected={(selected) => handleEventTypeChange(selected as string)}
                    />
                    <span className="text-base text-gray-600 font-display">occurs</span>
                </div>

                {ruleState.condition.attributes.length === 0 && (
                    <div>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={addAttribute}
                            className="font-medium flex items-center gap-1.5 text-sm -ml-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add Filter
                        </Button>
                    </div>
                )}
            </div>
        )
    }

    const renderTraceWhen = () => {
        if (!ruleState || !config) return null

        const traceConfig = config as TraceTargetingConfigResponse
        const traceNames = traceConfig.traces
            .filter((t): t is TraceTargetingConfig => 'name' in t)
            .map(t => t.name)

        const operators = config.operator_types?.string || ['eq']

        return (
            <div className="flex flex-col gap-4">
                <span className="text-xl font-display">When</span>

                <div className="flex items-center gap-3">
                    <span className="text-base text-gray-600 font-display">Trace with name</span>
                    <TraceOperatorNameInput
                        operator={ruleState.condition.spanOperator || "eq"}
                        value={ruleState.condition.spanName || ""}
                        suggestions={traceNames}
                        availableOperators={operators}
                        placeholder="Enter trace name"
                        onValueChange={(value) =>
                            setRuleState(prev =>
                                prev ? { ...prev, condition: { ...prev.condition, spanName: value } } : prev
                            )
                        }
                        onOperatorChange={(operator) =>
                            setRuleState(prev =>
                                prev ? { ...prev, condition: { ...prev.condition, spanOperator: operator } } : prev
                            )
                        }
                    />
                    <span className="text-base text-gray-600 font-display">ends</span>
                </div>

                {ruleState.condition.attributes.length === 0 && (
                    <div>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={addAttribute}
                            className="font-medium flex items-center gap-1.5 text-sm -ml-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add Filter
                        </Button>
                    </div>
                )}
            </div>
        )
    }

    const renderTimelineWhen = () => {
        if (!ruleState || !config) return null

        const sessionConfig = config as SessionTargetingConfigResponse

        const eventTypes = sessionConfig.events
            .filter((e): e is EventTargetingConfig => 'type' in e)
            .map(e => e.type)

        const traceNames = sessionConfig.traces
            .filter((t): t is TraceTargetingConfig => 'name' in t)
            .map(t => t.name)

        return (
            <div className="flex flex-col gap-4">
                <span className="text-xl font-display">When Session contains</span>

                <div className="flex items-center gap-3">
                    <DropdownSelect
                        type={DropdownSelectType.SingleString}
                        title="Select condition type"
                        items={['event', 'trace']}
                        initialSelected={ruleState.conditionType}
                        onChangeSelected={(selected) => handleConditionTypeChange(selected as 'event' | 'trace')}
                    />

                    {ruleState.conditionType === 'event' ? (
                        <>
                            <span className="text-base text-gray-600 font-display">with type</span>
                            <DropdownSelect
                                type={DropdownSelectType.SingleString}
                                title="Select event type"
                                items={eventTypes}
                                initialSelected={ruleState.condition.eventType ?? ''}
                                onChangeSelected={(selected) => handleEventTypeChange(selected as string)}
                            />
                        </>
                    ) : (
                        <>
                            <span className="text-base text-gray-600 font-display">with name</span>
                            <TraceOperatorNameInput
                                operator={ruleState.condition.spanOperator || "eq"}
                                value={ruleState.condition.spanName || ""}
                                suggestions={traceNames}
                                availableOperators={sessionConfig.operator_types?.string || ['eq']}
                                placeholder="Enter trace name"
                                onValueChange={(value) =>
                                    setRuleState(prev =>
                                        prev ? { ...prev, condition: { ...prev.condition, spanName: value } } : prev
                                    )
                                }
                                onOperatorChange={(operator) =>
                                    setRuleState(prev =>
                                        prev ? { ...prev, condition: { ...prev.condition, spanOperator: operator } } : prev
                                    )
                                }
                            />
                        </>
                    )}
                </div>

                {ruleState.condition.attributes.length === 0 && (
                    <div>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={addAttribute}
                            className="font-medium flex items-center gap-1.5 text-sm -ml-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add Filter
                        </Button>
                    </div>
                )}
            </div>
        )
    }

    const renderThen = () => {
        if (!ruleState) return null

        return (
            <div>
                <p className="max-w-6xl text-xl font-display">Then</p>

                <div className="py-2"></div>

                {type === 'timeline' ? (
                    <div className="mb-4">
                        <div className="flex items-center gap-3">
                            <SamplingRateInput
                                value={ruleState.sampleRate || 100}
                                onChange={(value) => updateRuleState({ sampleRate: value })}
                                disabled={false}
                                type="timeline"
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mb-4">
                            <p className="font-display text-gray-500 mb-3">Collection</p>
                            <div className="space-y-3 ml-4">
                                <label className="flex items-center gap-3 cursor-pointer h-10">
                                    <input
                                        type="radio"
                                        name="collectionMode"
                                        value="sampled"
                                        checked={ruleState.collectionMode === 'sampled'}
                                        onChange={() => updateRuleState({ collectionMode: 'sampled' })}
                                        className="appearance-none w-4 h-4 border border-gray-400 rounded-full outline-none cursor-pointer checked:bg-black checked:border-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-0 disabled:cursor-not-allowed"
                                    />
                                    <SamplingRateInput
                                        value={ruleState.sampleRate || 100}
                                        onChange={(value) => updateRuleState({ sampleRate: value })}
                                        disabled={ruleState.collectionMode !== 'sampled'}
                                        type={type === 'event' ? 'event' : 'trace'}
                                    />
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer h-10">
                                    <input
                                        type="radio"
                                        name="collectionMode"
                                        value="timeline"
                                        checked={ruleState.collectionMode === 'timeline'}
                                        onChange={() => updateRuleState({ collectionMode: 'timeline' })}
                                        className="appearance-none w-4 h-4 border border-gray-400 rounded-full outline-none cursor-pointer checked:bg-black checked:border-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-0 disabled:cursor-not-allowed"
                                    />
                                    <span className="text-sm font-body">Collect with timeline only</span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer h-10">
                                    <input
                                        type="radio"
                                        name="collectionMode"
                                        value="disabled"
                                        checked={ruleState.collectionMode === 'disabled'}
                                        onChange={() => updateRuleState({ collectionMode: 'disabled', take_layout_snapshot: false, take_screenshot: false })}
                                        className="appearance-none w-4 h-4 border border-gray-400 rounded-full outline-none cursor-pointer checked:bg-black checked:border-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-0 disabled:cursor-not-allowed"
                                    />
                                    <span className="text-sm font-body">Do not collect</span>
                                </label>
                            </div>
                        </div>

                        {type === 'event' && (
                            <div className="mb-4">
                                <p className="font-display text-gray-500 mb-3">Attachments</p>
                                <div className="space-y-3 ml-4">
                                    <label className={`flex items-center gap-3 h-10 ${ruleState.collectionMode === 'disabled' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                        <input
                                            type="radio"
                                            name="attachmentMode"
                                            value="layout_snapshot"
                                            checked={ruleState.take_layout_snapshot === true && ruleState.take_screenshot === false}
                                            onChange={() => updateRuleState({ take_layout_snapshot: true, take_screenshot: false })}
                                            disabled={ruleState.collectionMode === 'disabled'}
                                            className="appearance-none w-4 h-4 border border-gray-400 rounded-full outline-none cursor-pointer checked:bg-black checked:border-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-0 disabled:cursor-not-allowed"
                                        />
                                        <span className="text-sm font-body">Take layout snapshot</span>
                                    </label>

                                    <label className={`flex items-center gap-3 h-10 ${ruleState.collectionMode === 'disabled' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                        <input
                                            type="radio"
                                            name="attachmentMode"
                                            value="screenshot"
                                            checked={ruleState.take_screenshot === true && ruleState.take_layout_snapshot === false}
                                            onChange={() => updateRuleState({ take_screenshot: true, take_layout_snapshot: false })}
                                            disabled={ruleState.collectionMode === 'disabled'}
                                            className="appearance-none w-4 h-4 border border-gray-400 rounded-full outline-none cursor-pointer checked:bg-black checked:border-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-0 disabled:cursor-not-allowed"
                                        />
                                        <span className="text-sm font-body">Take screenshot</span>
                                    </label>

                                    <label className={`flex items-center gap-3 h-10 ${ruleState.collectionMode === 'disabled' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                        <input
                                            type="radio"
                                            name="attachmentMode"
                                            value="none"
                                            checked={ruleState.take_screenshot === false && ruleState.take_layout_snapshot === false}
                                            onChange={() => updateRuleState({ take_screenshot: false, take_layout_snapshot: false })}
                                            disabled={ruleState.collectionMode === 'disabled'}
                                            className="appearance-none w-4 h-4 border border-gray-400 rounded-full outline-none cursor-pointer checked:bg-black checked:border-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-0 disabled:cursor-not-allowed"
                                        />
                                        <span className="text-sm font-body">No attachments</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        )
    }

    const renderAttributes = () => {
        if (!ruleState || !config) return null

        const effectiveType = type === 'timeline' ? ruleState.conditionType : type

        const allAttributeKeys: Record<string, string> = {}

        if (effectiveType === 'event') {
            const eventConfig = config as EventTargetingConfigResponse | SessionTargetingConfigResponse
            const eventDef = 'events' in eventConfig
                ? eventConfig.events.find((e) => 'type' in e && e.type === ruleState.condition.eventType) as EventTargetingConfig | undefined
                : undefined

            const fixedAttrKeys = eventDef?.attrs?.map(a => a.key) ?? []
            const sessionAttrKeys = eventConfig.session_attrs?.map(a => a.key) ?? []
            const udAttrKeys = eventDef?.has_ud_attrs && 'event_ud_attrs' in eventConfig
                ? eventConfig.event_ud_attrs?.map(a => a.key) ?? []
                : []

            for (const key of fixedAttrKeys) {
                allAttributeKeys[key] = 'fixed'
            }
            for (const key of sessionAttrKeys) {
                allAttributeKeys[key] = 'session'
            }
            for (const key of udAttrKeys) {
                allAttributeKeys[key] = 'ud'
            }
        } else {
            const traceConfig = config as TraceTargetingConfigResponse | SessionTargetingConfigResponse
            const sessionAttrKeys = traceConfig.session_attrs?.map(a => a.key) ?? []
            const udAttrKeys = 'trace_ud_attrs' in traceConfig
                ? traceConfig.trace_ud_attrs?.map(a => a.key) ?? []
                : []

            for (const key of sessionAttrKeys) {
                allAttributeKeys[key] = 'session'
            }
            for (const key of udAttrKeys) {
                allAttributeKeys[key] = 'ud'
            }
        }

        if (ruleState.condition.attributes.length === 0) {
            return null
        }

        return (
            <div className="flex flex-col gap-6">
                {ruleState.condition.attributes.map(attr => (
                    <AttributeBuilder
                        key={attr.id}
                        attribute={attr}
                        attributeKeys={allAttributeKeys}
                        operators={getOperatorsForType(attr.type)}
                        suggestions={attr.suggestions}
                        onUpdateKey={(id, newKey, source) => {
                            updateAttributeKey(id, newKey, source as 'fixed' | 'session' | 'ud')
                        }}
                        onUpdateValue={(id, newValue) => {
                            updateAttributeValue(id, newValue)
                        }}
                        onUpdateOperator={(id, newOperator) => {
                            updateAttributeOperator(id, newOperator)
                        }}
                        onDelete={id => {
                            deleteAttribute(id)
                        }}
                        allowDelete
                    />
                ))}

                <div>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={addAttribute}
                        className="font-medium flex items-center gap-1.5 text-sm -ml-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Filter
                    </Button>
                </div>
            </div>
        )
    }

    useEffect(() => {
        if (type == 'event') {
            fetchEventPageData()
        } else if (type === 'trace') {
            fetchTracePageData()
        } else if (type === 'timeline') {
            fetchTimelinePageData()
        }
    }, [type, appId, mode, ruleId])

    return (
        <div>
            {/* Heading & save button */}
            <div className="flex flex-row items-center justify-between w-full">
                <p className="max-w-6xl text-4xl font-display">{pageHeading}</p>
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleSave}
                    className="border border-black font-display"
                    disabled={!shouldEnableSaveButton}
                    loading={uiState.saving}
                >
                    {mode === 'create' ? 'Publish Rule' : 'Save Changes'}
                </Button>
            </div>

            <div className="py-6" />

            {/* Loading state */}
            {uiState.pageState == PageState.Loading && (
                <div className="flex flex-col selection:bg-yellow-200/75 items-start">
                    <div className="py-1 w-full visible">
                        <LoadingSpinner />
                    </div>
                </div>
            )}

            {/* Error state */}
            {uiState.pageState == PageState.Error && (
                <div className="flex flex-col selection:bg-yellow-200/75 items-start">
                    <div className="w-full flex flex-col items-center">
                        <p className="text-normal font-body">Error loading rule. Please try again or go back.</p>
                        <div className="py-4" />
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={type == 'event' ? fetchEventPageData : fetchTracePageData} className="border border-black font-display">Retry</Button>
                            <Button variant="outline" onClick={onCancel} className="border border-black font-display">Go Back</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main content */}
            {uiState.pageState == PageState.Success && (
                <div className="flex flex-col gap-6 w-full">
                    {type === 'event' && renderEventWhen()}
                    {type === 'trace' && renderTraceWhen()}
                    {type === 'timeline' && renderTimelineWhen()}

                    {renderAttributes()}

                    <div className="py-2" />

                    {renderThen()}

                    <div className='py-1' />

                    <div className="flex flex-col gap-2">
                        <p className="max-w-6xl text-xl font-display">Rule Name</p>

                        <div className="py-0.5" />
                        <input
                            type="text"
                            placeholder="Enter a rule name"
                            maxLength={64}
                            value={ruleState?.name}
                            onChange={handleRuleNameChange}
                            className={`w-96 border rounded-md outline-none text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body disabled:opacity-50 disabled:cursor-not-allowed ${uiState.ruleNameError ? 'border-red-500' : 'border-black'}`}
                        />
                        {uiState.ruleNameError && (
                            <p className="text-red-600 text-sm ml-1">Rule name is required</p>
                        )}
                    </div>

                    <div className="py-6" />

                    {mode === 'edit' ? (
                        <div className="w-full flex justify-center">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={openDeleteDialog}
                                className="text-red-600 font-display hover:text-white hover:bg-red-600"
                            >
                                Delete Rule
                            </Button>
                        </div>
                    ) : <div />}

                    <DangerConfirmationDialog
                        body="Do you want to delete this rule? This action cannot be undone."
                        open={uiState.showDeleteDialog}
                        affirmativeText={uiState.deleting ? "Deleting…" : "Delete Rule"}
                        cancelText="Cancel"
                        onAffirmativeAction={handleDeleteRule}
                        onCancelAction={closeDeleteDialog}
                    />
                </div>
            )}
        </div>
    )
}