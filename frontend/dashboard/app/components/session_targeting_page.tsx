"use client"

import { createSessionTargetingRule, CreateSessionTargetingRuleApiStatus, emptySessionTargetingConfigResponse, emptySessionTargetingResponse, emptySessionTargetingRulesResponse, fetchSessionTargetingConfigFromServer, fetchSessionTargetingRuleFromServer, SessionTargetingConfigApiStatus, SessionTargetingRuleApiStatus, updateSessionTargetingRule, UpdateSessionTargetingRuleApiStatus } from '@/app/api/api_calls';
import { conditionsToCel } from '@/app/cel/cel_generator';
import LoadingSpinner from '@/app/components/loading_spinner';
import RuleBuilderConditionSection from '@/app/components/rule_builder_condition_section';
import RuleBuilderEventCondition from '@/app/components/rule_builder_event_condition';
import RuleBuilderLogicalOperator from '@/app/components/rule_builder_logical_operator';
import RuleBuilderSessionCondition from '@/app/components/rule_builder_session_condition';
import SaveSessionTargetingRule from '@/app/components/save_session_targeting_rule';
import SwitchToggle from '@/app/components/switch';
import { EventCondition, EventConditions, SessionCondition, SessionConditions } from '@/app/types/session-targeting-types';
import { toastNegative } from '@/app/utils/use_toast';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { celToConditions } from '../cel/cel_parser';

export type SessionTargetingRulesConfig = typeof emptySessionTargetingRulesResponse;
const MAX_CONDITIONS = 10;
const MAX_ATTRIBUTES_PER_CONDITION = 10;
const MAX_RULE_NAME_LENGTH = 256;

interface PageState {
    // Loading/error states
    isLoading: boolean
    hasError: boolean

    // API data
    config: typeof emptySessionTargetingConfigResponse | null
    rule: typeof emptySessionTargetingResponse | null

    // Form fields
    name: string
    nameHasError: boolean
    nameErrorMessage: string
    samplingRate: number
    status: 'enabled' | 'disabled'
    eventConditions: EventConditions
    sessionConditions: SessionConditions
}

const initialPageState: PageState = {
    isLoading: true,
    hasError: false,
    config: null,
    rule: null,
    name: '',
    nameHasError: false,
    nameErrorMessage: '',
    samplingRate: 100,
    status: 'enabled',
    eventConditions: { conditions: [], operators: [] },
    sessionConditions: { conditions: [], operators: [] }
}

interface SessionTargetingRulePageProps {
    params: {
        teamId: string;
        appId: string;
        ruleId?: string; // Only present for edit mode
    };
    isEditMode: boolean;
}

type AttributeType = 'attrs' | 'ud_attrs';

const createEmptySessionCondition = (): SessionCondition => ({
    id: crypto.randomUUID(),
    attrs: []
})

export const getEventTypesFromResponse = (response: typeof emptySessionTargetingConfigResponse) => {
    return response.result?.events?.map(event => event.type) || [];
};

const getEventAttributes = (response: typeof emptySessionTargetingConfigResponse, eventType: string) => {
    const event = response.result?.events?.find(e => e.type === eventType);
    return event?.attrs || [];
};

const getSessionAttributes = (response: typeof emptySessionTargetingConfigResponse) => {
    return response.result?.session_attrs || [];
};

const doesEventSupportUdAttrs = (response: typeof emptySessionTargetingConfigResponse, eventType: string): boolean => {
    const event = response.result?.events?.find(e => e.type === eventType);
    return event?.ud_attrs === true;
};

const getUserDefinedAttributes = (response: typeof emptySessionTargetingConfigResponse) => {
    return response.result?.event_ud_attrs?.key_types || [];
};

const getOperatorTypesMapping = (response: typeof emptySessionTargetingConfigResponse) => {
    return response.result?.operator_types || {};
};

const getOperatorsForType = (operatorMapping: Record<string, string[]>, type: string): string[] => {
    return operatorMapping[type] || [];
};

const canAddMoreAttributes = (
    condition: EventCondition | SessionCondition,
    availableAttrs: any[],
    attributeType: AttributeType = 'attrs'
): boolean => {
    if (attributeType === 'ud_attrs' && 'ud_attrs' in condition) {
        const currentAttrs = condition.ud_attrs;
        const currentCount = currentAttrs ? currentAttrs.length : 0;

        if (currentCount >= MAX_ATTRIBUTES_PER_CONDITION) {
            return false;
        }
    } else if (attributeType === 'attrs') {
        const currentAttrs = condition.attrs;
        const currentCount = currentAttrs ? currentAttrs.length : 0;

        if (currentCount >= MAX_ATTRIBUTES_PER_CONDITION) {
            return false;
        }
    } else {
        return false;
    }

    return availableAttrs.length > 0;
};

const getAvailableAttributes = (
    SessionTargetingConfig: typeof emptySessionTargetingConfigResponse,
    eventType: string | null,
    attributeType: AttributeType
) => {
    if (attributeType === 'attrs' && eventType) {
        return getEventAttributes(SessionTargetingConfig, eventType);
    } else if (attributeType === 'ud_attrs' && eventType) {
        if (doesEventSupportUdAttrs(SessionTargetingConfig, eventType)) {
            return getUserDefinedAttributes(SessionTargetingConfig);
        }
        return [];
    }
    return [];
};

function getDefaultOperatorForType(type: string): string {
    switch (type) {
        case 'string':
            return 'eq'
        case 'bool':
        case 'boolean':
            return 'eq'
        case 'int64':
        case 'float64':
        case 'number':
            return 'eq'
        default:
            return 'eq'
    }
}

const isValueEmpty = (value: string | boolean | number, type: string): boolean => {
    // Boolean values are never considered empty since they're selected from dropdown
    if (type === 'bool') return false;

    // For all other types, check if the string representation is empty
    return String(value).trim() === '';
};

const validateAllAttributes = (eventConditions: EventConditions, sessionConditions: SessionConditions): { eventConditions: EventConditions, sessionConditions: SessionConditions } => {
    // Validate event conditions
    const validatedEventConditions = {
        ...eventConditions,
        conditions: eventConditions.conditions.map(condition => ({
            ...condition,
            attrs: condition.attrs?.map(attr => ({
                ...attr,
                hasError: isValueEmpty(attr.value, attr.type),
                errorMessage: isValueEmpty(attr.value, attr.type) ? 'Value cannot be empty' : undefined
            })) || [],
            ud_attrs: condition.ud_attrs?.map(attr => ({
                ...attr,
                hasError: isValueEmpty(attr.value, attr.type),
                errorMessage: isValueEmpty(attr.value, attr.type) ? 'Value cannot be empty' : undefined
            })) || []
        }))
    };

    // Validate session conditions
    const validatedSessionConditions = {
        ...sessionConditions,
        conditions: sessionConditions.conditions.map(condition => ({
            ...condition,
            attrs: condition.attrs?.map(attr => ({
                ...attr,
                hasError: isValueEmpty(attr.value, attr.type),
                errorMessage: isValueEmpty(attr.value, attr.type) ? 'Value cannot be empty' : undefined
            })) || []
        }))
    };

    return { eventConditions: validatedEventConditions, sessionConditions: validatedSessionConditions };
};

const isValidForm = (eventConditions: EventConditions, sessionConditions: SessionConditions, ruleName: string): boolean => {
    const hasValidEventConditions = eventConditions.conditions.some(condition =>
        condition.type !== null ||
        (condition.attrs && condition.attrs.length > 0) ||
        (condition.ud_attrs && condition.ud_attrs.length > 0)
    )

    const hasValidSessionConditions = sessionConditions.conditions.some(condition =>
        condition.attrs && condition.attrs.length > 0
    )

    const hasValidName = ruleName.trim().length > 0
    const hasAtLeastOneCondition = hasValidEventConditions || hasValidSessionConditions

    return hasValidName && hasAtLeastOneCondition
}

export default function SessionTargetingPage({ params, isEditMode }: SessionTargetingRulePageProps) {
    const router = useRouter()
    const [pageState, setPageState] = useState<PageState>(initialPageState)

    const isFormValid = useMemo(() => {
        return isValidForm(pageState.eventConditions, pageState.sessionConditions, pageState.name)
    }, [pageState.eventConditions, pageState.sessionConditions, pageState.name])

    const isPageReady = useMemo(() => {
        return !pageState.isLoading && !pageState.hasError && pageState.config !== null
    }, [pageState.isLoading, pageState.hasError, pageState.config])

    // Main initialization effect
    useEffect(() => {
        const initializePage = async () => {
            try {
                const config = await loadConfig()
                if (isEditMode) {
                    const rule = await loadRule()
                    setupEditMode(config, rule)
                } else {
                    setupCreateMode(config)
                }
            } catch (error) {
                console.error('Failed to initialize page:', error)
                setPageState(prev => ({ ...prev, hasError: true, isLoading: false }))
            }
        }

        initializePage()
    }, [])

    // API functions
    const loadConfig = async () => {
        const result = await fetchSessionTargetingConfigFromServer(params.teamId, params.appId)

        if (result.status === SessionTargetingConfigApiStatus.Error) {
            throw new Error('Failed to load config')
        }

        const config = result.data
        setPageState(prev => ({ ...prev, config }))
        return config
    }

    const loadRule = async () => {
        if (!params.ruleId) {
            throw new Error('No rule ID provided')
        }

        const result = await fetchSessionTargetingRuleFromServer(params.teamId, params.appId, params.ruleId)

        if (result.status === SessionTargetingRuleApiStatus.Error) {
            throw new Error('Failed to load rule')
        }

        const rule = result.data
        setPageState(prev => ({ ...prev, rule }))
        return rule
    }

    // Setup functions
    const setupCreateMode = (config: typeof emptySessionTargetingConfigResponse) => {
        const eventTypes = getEventTypesFromResponse(config)
        const firstEventType = eventTypes[0] || null

        setPageState(prev => ({
            ...prev,
            isLoading: false,
            eventConditions: firstEventType ? {
                conditions: [{ id: crypto.randomUUID(), type: firstEventType, attrs: [], ud_attrs: [] }],
                operators: []
            } : { conditions: [], operators: [] }
        }))
    }

    const setupEditMode = (config: typeof emptySessionTargetingConfigResponse, rule: typeof emptySessionTargetingResponse) => {
        if (!rule.results) {
            throw new Error('Invalid rule data')
        }

        const ruleData = rule.results
        const conditions = celToConditions(ruleData.rule)

        const eventConditions = conditions?.event
            ? conditions?.event
            : { conditions: [], operators: [] }

        const sessionConditions = conditions?.session
            ? conditions?.session
            : { conditions: [], operators: [] }

        setPageState(prev => ({
            ...prev,
            isLoading: false,
            name: ruleData.name || '',
            samplingRate: ruleData.sampling_rate || 100,
            status: ruleData.status === 1 ? 'enabled' : 'disabled',
            eventConditions: eventConditions,
            sessionConditions: sessionConditions
        }))
    }


    // Event handlers
    const updatePageState = (updates: Partial<PageState>) => {
        setPageState(prev => ({ ...prev, ...updates }))
    }

    const handleTitleChange = (name: string) => {
        updatePageState({
            name,
            nameHasError: false,
            nameErrorMessage: ''
        })
    }

    const handleSamplingRateChange = (value: string) => {
        updatePageState({ samplingRate: Number(value) })
    }

    const handleSamplingRateBlur = (value: string) => {
        const numValue = Number(value)
        const clampedValue = Math.max(0, Math.min(100, isNaN(numValue) ? 0 : numValue))
        updatePageState({ samplingRate: clampedValue })
    }

    const handleStatusChange = (enabled: boolean) => {
        updatePageState({ status: enabled ? 'enabled' : 'disabled' })
    }

    // Event condition handlers
    const addEventCondition = () => {
        if (!pageState.config || pageState.eventConditions.conditions.length >= MAX_CONDITIONS) return

        const eventTypes = getEventTypesFromResponse(pageState.config)
        if (eventTypes.length === 0) return

        const newCondition: EventCondition = {
            id: crypto.randomUUID(),
            type: eventTypes[0],
            attrs: [],
            ud_attrs: []
        }

        const newOperators = pageState.eventConditions.conditions.length > 0
            ? [...pageState.eventConditions.operators, 'AND' as const]
            : []

        updatePageState({
            eventConditions: {
                conditions: [...pageState.eventConditions.conditions, newCondition],
                operators: newOperators
            }
        })
    }

    const removeEventCondition = (conditionId: string) => {
        const conditionIndex = pageState.eventConditions.conditions.findIndex(c => c.id === conditionId)
        if (conditionIndex === -1) return

        const newConditions = pageState.eventConditions.conditions.filter(c => c.id !== conditionId)
        const newOperators = removeOperatorAtIndex(pageState.eventConditions.operators, conditionIndex)

        updatePageState({
            eventConditions: {
                conditions: newConditions,
                operators: newOperators
            }
        })
    }

    const updateEventCondition = (conditionIndex: number, type: string) => {
        const updatedConditions = pageState.eventConditions.conditions.map((condition, index) =>
            index === conditionIndex
                ? { ...condition, type, attrs: [], ud_attrs: [] }
                : condition
        )

        updatePageState({
            eventConditions: {
                ...pageState.eventConditions,
                conditions: updatedConditions
            }
        })
    }

    const updateEventOperator = (operatorIndex: number, operator: 'AND' | 'OR') => {
        const newOperators = [...pageState.eventConditions.operators]
        newOperators[operatorIndex] = operator

        updatePageState({
            eventConditions: {
                ...pageState.eventConditions,
                operators: newOperators
            }
        })
    }

    const addAttribute = (conditionIndex: number, attributeType: AttributeType) => {
        const condition = pageState.eventConditions.conditions[conditionIndex]
        if (!condition || !condition.type || !pageState.config) return

        const availableAttrs = getAvailableAttributes(pageState.config, condition.type, attributeType)
        if (!canAddMoreAttributes(condition, availableAttrs, attributeType)) return

        const firstAttr = availableAttrs[0]
        if (!firstAttr) return

        const newAttr = createDefaultAttribute(firstAttr)

        const updatedConditions = pageState.eventConditions.conditions.map((cond, index) =>
            index === conditionIndex
                ? {
                    ...cond,
                    [attributeType]: cond[attributeType] ? [...cond[attributeType]!, newAttr] : [newAttr]
                }
                : cond
        )

        updatePageState({
            eventConditions: {
                ...pageState.eventConditions,
                conditions: updatedConditions
            }
        })
    }

    const removeAttribute = (conditionIndex: number, attributeId: string, attributeType: AttributeType) => {
        const condition = pageState.eventConditions.conditions[conditionIndex]
        const currentAttrs = condition?.[attributeType]
        if (!currentAttrs) return

        const updatedAttrs = currentAttrs.filter((attr) => attr.id !== attributeId)

        const updatedConditions = pageState.eventConditions.conditions.map((cond, index) =>
            index === conditionIndex
                ? { ...cond, [attributeType]: updatedAttrs.length > 0 ? updatedAttrs : null }
                : cond
        )

        updatePageState({
            eventConditions: {
                ...pageState.eventConditions,
                conditions: updatedConditions
            }
        })
    }

    const updateAttribute = (
        conditionIndex: number,
        attrIndex: number,
        field: 'key' | 'type' | 'value' | 'operator',
        value: any,
        attributeType: AttributeType
    ) => {
        if (!pageState.config) return

        const condition = pageState.eventConditions.conditions[conditionIndex]
        const currentAttrs = condition?.[attributeType]
        if (!currentAttrs) return

        const updatedAttrs = currentAttrs.map((attr, index) => {
            if (index === attrIndex) {
                const updatedAttr = { ...attr, [field]: value }

                if (field === 'key') {
                    const availableAttrs = getAvailableAttributes(pageState.config!, condition.type, attributeType)
                    const selectedAttr = availableAttrs.find(a => a.key === value)
                    if (selectedAttr) {
                        updatedAttr.type = selectedAttr.type
                        updatedAttr.value = selectedAttr.type === 'boolean' ? false : ''
                        updatedAttr.operator = getDefaultOperatorForType(selectedAttr.type)
                        updatedAttr.hasError = false
                        updatedAttr.errorMessage = undefined
                    }
                } else if (field === 'value') {
                    // Clear validation errors when user starts typing
                    updatedAttr.hasError = false
                    updatedAttr.errorMessage = undefined
                }

                return updatedAttr
            }
            return attr
        })

        const updatedConditions = pageState.eventConditions.conditions.map((cond, index) =>
            index === conditionIndex
                ? { ...cond, [attributeType]: updatedAttrs }
                : cond
        )

        updatePageState({
            eventConditions: {
                ...pageState.eventConditions,
                conditions: updatedConditions
            }
        })
    }


    // Session condition handlers  
    const addSessionCondition = () => {
        if (!pageState.config || pageState.sessionConditions.conditions.length >= MAX_CONDITIONS) return

        const sessionAttrs = getSessionAttributes(pageState.config)
        const newCondition = createEmptySessionCondition()

        if (sessionAttrs.length > 0) {
            const firstAttr = sessionAttrs[0]
            newCondition.attrs = [createDefaultAttribute(firstAttr)]
        }

        const newOperators = pageState.sessionConditions.conditions.length > 0
            ? [...pageState.sessionConditions.operators, 'AND' as const]
            : []

        updatePageState({
            sessionConditions: {
                conditions: [...pageState.sessionConditions.conditions, newCondition],
                operators: newOperators
            }
        })
    }

    const removeSessionCondition = (conditionId: string) => {
        const conditionIndex = pageState.sessionConditions.conditions.findIndex(c => c.id === conditionId)
        if (conditionIndex === -1) return

        const newConditions = pageState.sessionConditions.conditions.filter(c => c.id !== conditionId)
        const newOperators = removeOperatorAtIndex(pageState.sessionConditions.operators, conditionIndex)

        updatePageState({
            sessionConditions: {
                conditions: newConditions,
                operators: newOperators
            }
        })
    }

    const updateSessionOperator = (operatorIndex: number, operator: 'AND' | 'OR') => {
        const newOperators = [...pageState.sessionConditions.operators]
        newOperators[operatorIndex] = operator

        updatePageState({
            sessionConditions: {
                ...pageState.sessionConditions,
                operators: newOperators
            }
        })
    }

    const updateSessionAttribute = (
        conditionIndex: number,
        attrIndex: number,
        field: 'key' | 'type' | 'value' | 'operator',
        value: any
    ) => {
        if (!pageState.config) return

        const condition = pageState.sessionConditions.conditions[conditionIndex]
        const currentAttrs = condition?.attrs
        if (!currentAttrs) return

        const updatedAttrs = currentAttrs.map((attr, index) => {
            if (index === attrIndex) {
                const updatedAttr = { ...attr, [field]: value }

                if (field === 'key') {
                    const sessionAttrs = getSessionAttributes(pageState.config!)
                    const selectedAttr = sessionAttrs.find(a => a.key === value)
                    if (selectedAttr) {
                        updatedAttr.type = selectedAttr.type
                        updatedAttr.value = selectedAttr.type === 'bool' ? false : ''
                        updatedAttr.operator = getDefaultOperatorForType(selectedAttr.type)
                        updatedAttr.hasError = false
                        updatedAttr.errorMessage = undefined
                    }
                } else if (field === 'value') {
                    // Clear validation errors when user starts typing
                    updatedAttr.hasError = false
                    updatedAttr.errorMessage = undefined
                }

                return updatedAttr
            }
            return attr
        })

        const updatedConditions = pageState.sessionConditions.conditions.map((cond, index) =>
            index === conditionIndex
                ? { ...cond, attrs: updatedAttrs }
                : cond
        )

        updatePageState({
            sessionConditions: {
                ...pageState.sessionConditions,
                conditions: updatedConditions
            }
        })
    }


    // Helper functions
    const removeOperatorAtIndex = (operators: ('AND' | 'OR')[], conditionIndex: number): ('AND' | 'OR')[] => {
        const newOperators = [...operators]

        if (conditionIndex < newOperators.length) {
            newOperators.splice(conditionIndex, 1)
        } else if (conditionIndex > 0 && newOperators.length > 0) {
            newOperators.splice(conditionIndex - 1, 1)
        }

        return newOperators
    }

    const createDefaultAttribute = (attrConfig: any) => ({
        id: crypto.randomUUID(),
        key: attrConfig.key,
        type: attrConfig.type,
        value: attrConfig.type === 'bool' ? false : '',
        operator: getDefaultOperatorForType(attrConfig.type)
    })

    // Submit handlers
    const handleSubmit = async () => {
        // Validate all attributes
        const { eventConditions: validatedEventConditions, sessionConditions: validatedSessionConditions } =
            validateAllAttributes(pageState.eventConditions, pageState.sessionConditions);

        // Check if there are any validation errors
        const hasAttributeErrors =
            validatedEventConditions.conditions.some(condition =>
                (condition.attrs && condition.attrs.some(attr => attr.hasError)) ||
                (condition.ud_attrs && condition.ud_attrs.some(attr => attr.hasError))
            ) ||
            validatedSessionConditions.conditions.some(condition =>
                condition.attrs && condition.attrs.some(attr => attr.hasError)
            );

        // Update state with validation results
        updatePageState({
            eventConditions: validatedEventConditions,
            sessionConditions: validatedSessionConditions
        });

        // If there are validation errors, show toast and stop submission
        if (hasAttributeErrors) {
            toastNegative(`Some fields are empty or invalid. Please fix and try again.`);
            return;
        }

        const ruleCel = conditionsToCel({
            event: pageState.eventConditions,
            trace: undefined,
            session: pageState.sessionConditions
        })

        if (!ruleCel) {
            console.error('No valid conditions to create a rule.')
            return
        }

        const ruleData = {
            name: pageState.name,
            status: pageState.status === 'enabled' ? 1 : 0,
            sampling_rate: pageState.samplingRate,
            rule: ruleCel,
            id: pageState.rule?.results?.id || ''
        }

        console.log('Rule:', ruleData)

        try {
            const result = isEditMode
                ? await updateSessionTargetingRule(params.teamId, params.appId, ruleData.id!, ruleData)
                : await createSessionTargetingRule(params.teamId, params.appId, ruleData)

            if (result.status === CreateSessionTargetingRuleApiStatus.Success ||
                result.status === UpdateSessionTargetingRuleApiStatus.Success) {
                router.push(`/teams/${params.teamId}/apps/${params.appId}/session-targeting`)
            } else {
                console.error('Failed to save rule:', result.error)
            }
        } catch (error) {
            console.error('Error saving rule:', error)
        }
    }

    // Render helpers
    if (pageState.hasError) {
        return (
            <div className="flex flex-col selection:bg-yellow-200/75 items-start">
                <p className="text-lg font-display">
                    Error loading rule. Please refresh the page to try again.
                </p>
            </div>
        )
    }

    if (pageState.isLoading) {
        return (
            <div className="flex flex-col selection:bg-yellow-200/75 items-start">
                <LoadingSpinner />
            </div>
        )
    }

    const eventTypes = pageState.config ? getEventTypesFromResponse(pageState.config) : []
    const operatorTypesMapping = pageState.config ? getOperatorTypesMapping(pageState.config) : {}
    const sessionAttrs = pageState.config ? getSessionAttributes(pageState.config) : []

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <div className="flex flex-row items-start gap-2 justify-between w-full">
                <div className="flex flex-col">
                    <h1 className="font-display text-4xl">Session Targeting Rule</h1>

                    <div className="py-6" />

                    {isPageReady && (
                        <>
                            <div className="grid gap-y-6 items-center max-w-2xl" style={{ gridTemplateColumns: '120px 1fr' }}>
                                <p className="text-sm">Rule name</p>
                                <div className={`relative ${pageState.nameHasError ? 'mb-6' : ''}`}>
                                    <input
                                        type="text"
                                        placeholder="Enter rule name"
                                        value={pageState.name}
                                        maxLength={MAX_RULE_NAME_LENGTH}
                                        onChange={(e) => handleTitleChange(e.target.value)}
                                        className={`w-96 border rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400 ${pageState.nameHasError ? 'border-red-500' : 'border-black'
                                            }`}
                                    />
                                    {pageState.nameHasError && pageState.nameErrorMessage && (
                                        <p className="absolute top-full left-0 w-full text-red-500 text-xs mt-1 ml-1">{pageState.nameErrorMessage}</p>
                                    )}
                                </div>
                                <p className="text-sm">Sampling rate %</p>
                                <div className="flex items-center">
                                    <input
                                        type="number"
                                        placeholder="0-100%"
                                        value={pageState.samplingRate}
                                        min={0}
                                        max={100}
                                        step="0.1"
                                        onChange={(e) => handleSamplingRateChange(e.target.value)}
                                        onBlur={(e) => handleSamplingRateBlur(e.target.value)}
                                        className="w-32 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400"
                                    />
                                </div>
                                <p className="text-sm">Status</p>
                                <SwitchToggle
                                    toggled={pageState.status === 'enabled'}
                                    onToggle={handleStatusChange}
                                    disabled={false}
                                />
                            </div>
                        </>
                    )}
                </div>
                <SaveSessionTargetingRule
                    isEditMode={isEditMode}
                    isDisabled={!isFormValid || !isPageReady}
                    onPublish={handleSubmit}
                    onUpdate={handleSubmit}
                />
            </div>
            <div className="py-2" />

            <div className="py-4" />

            {/* Main sampling conditions UI */}
            {isPageReady && (
                <div className="w-full space-y-4">
                    <div className="w-full space-y-4">
                        {/* Event conditions */}
                        <RuleBuilderConditionSection
                            title="Event Conditions"
                            conditionCount={pageState.eventConditions.conditions.length}
                            maxConditions={MAX_CONDITIONS}
                            onAddCondition={addEventCondition}
                        >
                            {pageState.eventConditions.conditions.length > 0 && (
                                <div className="pt-1">
                                    {pageState.eventConditions.conditions.map((condition, index) => {
                                        const availableAttrs = condition.type && pageState.config ? getEventAttributes(pageState.config, condition.type) : []
                                        const canAddMoreAttrs = canAddMoreAttributes(condition, availableAttrs, 'attrs')
                                        const userDefinedAttrs = pageState.config ? getUserDefinedAttributes(pageState.config) : []
                                        const canAddMoreUdAttrs = canAddMoreAttributes(condition, userDefinedAttrs, 'ud_attrs')
                                        const supportsUdAttrs = pageState.config && condition.type ? doesEventSupportUdAttrs(pageState.config, condition.type) : false
                                        
                                        return (
                                            <div key={condition.id}>
                                                <RuleBuilderEventCondition
                                                    condition={condition}
                                                    index={index}
                                                    eventTypes={eventTypes}
                                                    availableAttrs={availableAttrs}
                                                    userDefinedAttrs={userDefinedAttrs}
                                                    operatorTypesMapping={operatorTypesMapping}
                                                    canAddMoreAttrs={canAddMoreAttrs}
                                                    canAddMoreUdAttrs={canAddMoreUdAttrs}
                                                    supportsUdAttrs={supportsUdAttrs}
                                                    pageConfig={pageState.config!}
                                                    onUpdateCondition={updateEventCondition}
                                                    onRemoveCondition={removeEventCondition}
                                                    onAddAttribute={addAttribute}
                                                    onUpdateAttribute={updateAttribute}
                                                    onRemoveAttribute={removeAttribute}
                                                    getOperatorsForType={getOperatorsForType}
                                                />

                                                {index < pageState.eventConditions.conditions.length - 1 && (
                                                    <div className="flex justify-center">
                                                        <RuleBuilderLogicalOperator
                                                            value={pageState.eventConditions.operators[index] || 'AND'}
                                                            onChange={(operator) => updateEventOperator(index, operator)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </RuleBuilderConditionSection>

                        <div className="py-2" />

                        {/* Session conditions */}
                        <RuleBuilderConditionSection
                            title="Session Conditions"
                            conditionCount={pageState.sessionConditions.conditions.length}
                            maxConditions={MAX_CONDITIONS}
                            onAddCondition={addSessionCondition}
                        >
                            {pageState.sessionConditions.conditions.length > 0 && (
                                <div className="pt-1">
                                    {pageState.sessionConditions.conditions.map((condition, index) => (
                                        <div key={condition.id}>
                                            <RuleBuilderSessionCondition
                                                condition={condition}
                                                index={index}
                                                sessionAttrs={sessionAttrs}
                                                operatorTypesMapping={operatorTypesMapping}
                                                onRemoveCondition={removeSessionCondition}
                                                onUpdateAttribute={updateSessionAttribute}
                                                getOperatorsForType={getOperatorsForType}
                                            />

                                            {index < pageState.sessionConditions.conditions.length - 1 && (
                                                <div className="flex justify-center">
                                                    <RuleBuilderLogicalOperator
                                                        value={pageState.sessionConditions.operators[index] || 'AND'}
                                                        onChange={(operator) => updateSessionOperator(index, operator)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </RuleBuilderConditionSection>
                    </div>
                </div>
            )}
        </div>
    );
}