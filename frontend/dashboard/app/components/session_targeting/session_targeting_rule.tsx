"use client"

import { createSessionTargetingRule, CreateSessionTargetingRuleApiStatus, SessionTargetingConfigResponse, fetchSessionTargetingConfigFromServer, fetchSessionTargetingRuleFromServer, SessionTargetingConfigApiStatus, SessionTargetingRuleApiStatus, updateSessionTargetingRule, UpdateSessionTargetingRuleApiStatus, SessionTargetingRuleResponse } from '@/app/api/api_calls';
import { conditionsToCel } from '@/app/utils/cel/cel_generator';
import { EventCondition, EventConditions, SessionCondition, SessionConditions } from '@/app/utils/cel/conditions';
import LoadingSpinner from '@/app/components/loading_spinner';
import RuleBuilderConditionSection from '@/app/components/session_targeting/rule_builder_condition_section';
import RuleBuilderEventCondition from '@/app/components/session_targeting/rule_builder_event_condition';
import RuleBuilderLogicalOperator from '@/app/components/session_targeting/rule_builder_logical_operator';
import RuleBuilderSessionCondition from '@/app/components/session_targeting/rule_builder_session_condition';
import SaveSessionTargetingRule from '@/app/components/session_targeting/save_session_targeting_rule';
import { toastNegative, toastPositive } from '@/app/utils/use_toast';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { celToConditions } from '../../utils/cel/cel_parser';
import { Switch } from '../switch';

const MAX_CONDITIONS = 10;
const MAX_ATTRIBUTES_PER_CONDITION = 10;
const MAX_RULE_NAME_LENGTH = 256;

enum PageStatus {
    Loading = 'loading',
    Ready = 'ready',
    Error = 'error'
}
interface PageState {
    status: PageStatus
    config: SessionTargetingConfigResponse | null
    ruleResponse: SessionTargetingRuleResponse | null
}

interface RuleState {
    name: string
    samplingRate: string
    status: 'enabled' | 'disabled'
    eventConditions: EventConditions
    sessionConditions: SessionConditions
}

interface SaveRuleState {
    isSubmitting: boolean
}

interface SessionTargetingRuleProps {
    params: {
        teamId: string;
        appId: string;
        ruleId?: string;
    };
    isEditMode: boolean;
}

type AttrType = 'attrs' | 'ud_attrs';

const initialPageState: PageState = {
    status: PageStatus.Loading,
    config: null,
    ruleResponse: null,
}

const initialSaveRuleState: SaveRuleState = {
    isSubmitting: false,
}

const emptyRuleState: RuleState = {
    name: '',
    samplingRate: '100',
    status: 'disabled',
    eventConditions: { conditions: [], operators: [] },
    sessionConditions: { conditions: [], operators: [] }
}

const createEmptySessionCondition = (): SessionCondition => ({
    id: crypto.randomUUID(),
    attrs: []
})

const createEmptyEventCondition = (eventType: string): EventCondition => ({
    id: crypto.randomUUID(),
    type: eventType,
    attrs: [],
    ud_attrs: []
})

const getEventTypesFromResponse = (response: SessionTargetingConfigResponse) => {
    return response.result?.events?.map(event => event.type) || [];
};

const getEventAttributes = (response: SessionTargetingConfigResponse, eventType: string) => {
    const event = response.result?.events?.find(e => e.type === eventType);
    return event?.attrs || [];
};

const getSessionAttributes = (response: SessionTargetingConfigResponse) => {
    return response.result?.session_attrs || [];
};

const doesEventSupportUdAttrs = (response: SessionTargetingConfigResponse, eventType: string): boolean => {
    const event = response.result?.events?.find(e => e.type === eventType);
    return event?.has_ud_attrs === true;
};

const getUserDefinedAttributes = (response: SessionTargetingConfigResponse) => {
    return response.result?.event_ud_attrs || [];
};

const getOperatorTypesMapping = (response: SessionTargetingConfigResponse) => {
    return response.result?.operator_types || {};
};

const getOperatorsForType = (operatorMapping: Record<string, string[]>, type: string): string[] => {
    return operatorMapping[type] || [];
};

const getDefaultOperatorForType = (type: string): string => {
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

const canAddMoreAttributes = (
    condition: EventCondition | SessionCondition,
    availableAttrs: any[],
    attrType: AttrType = 'attrs'
): boolean => {
    if (attrType === 'ud_attrs' && 'ud_attrs' in condition) {
        const currentAttrs = condition.ud_attrs;
        const currentCount = currentAttrs ? currentAttrs.length : 0;

        if (currentCount >= MAX_ATTRIBUTES_PER_CONDITION) {
            return false;
        }
    } else if (attrType === 'attrs') {
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
    SessionTargetingConfig: SessionTargetingConfigResponse,
    eventType: string | null,
    attrType: AttrType
) => {
    if (attrType === 'attrs' && eventType) {
        return getEventAttributes(SessionTargetingConfig, eventType);
    } else if (attrType === 'ud_attrs' && eventType) {
        if (doesEventSupportUdAttrs(SessionTargetingConfig, eventType)) {
            return getUserDefinedAttributes(SessionTargetingConfig);
        }
        return [];
    }
    return [];
};

const isValueEmpty = (value: string | boolean | number): boolean => {
    return String(value).trim() === '';
};

const formatSamplingRate = (value: string): string => {
    if (value === '') return ''

    const numValue = parseFloat(value)
    if (isNaN(numValue)) return ''

    // Clamp to 0-100 range
    const clampedValue = Math.max(0, Math.min(100, numValue))
    // Limit to 6 decimal places and remove trailing zeros
    const formattedValue = Math.round(clampedValue * 1000000) / 1000000
    return formattedValue.toString()
};

const parseSamplingRateForSubmission = (value: string): number => {
    const numValue = parseFloat(value)
    return isNaN(numValue) ? 0 : Math.max(0, Math.min(100, numValue))
};

const validateAllAttributes = (eventConditions: EventConditions, sessionConditions: SessionConditions): { eventConditions: EventConditions, sessionConditions: SessionConditions } => {
    // Validate event conditions
    const validatedEventConditions = {
        ...eventConditions,
        conditions: eventConditions.conditions.map(condition => ({
            ...condition,
            attrs: condition.attrs?.map(attr => ({
                ...attr,
                hasError: isValueEmpty(attr.value),
                errorMessage: isValueEmpty(attr.value) ? 'Please enter a value' : undefined
            })) || [],
            ud_attrs: condition.ud_attrs?.map(attr => ({
                ...attr,
                hasError: isValueEmpty(attr.value),
                errorMessage: isValueEmpty(attr.value) ? 'Please enter a value' : undefined
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
                hasError: isValueEmpty(attr.value),
                errorMessage: isValueEmpty(attr.value) ? 'Please enter a value' : undefined
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

const compareRuleState = (left: RuleState, right: RuleState): boolean => {
    return JSON.stringify(left) === JSON.stringify(right)
}

export default function SessionTargetingRule({ params, isEditMode }: SessionTargetingRuleProps) {
    const router = useRouter()
    const [pageState, setPageState] = useState<PageState>(initialPageState)
    const [saveRuleState, setSaveRuleState] = useState<SaveRuleState>(initialSaveRuleState)
    const [ruleState, setRuleState] = useState<RuleState>(emptyRuleState)
    const [initialRuleState, setInitialRuleState] = useState<RuleState | null>(null)

    const isFormValid = useMemo(() => {
        return isValidForm(ruleState.eventConditions, ruleState.sessionConditions, ruleState.name)
    }, [ruleState.eventConditions, ruleState.sessionConditions, ruleState.name])

    const hasUnsavedChanges = !initialRuleState ? false : !compareRuleState(ruleState, initialRuleState)

    useEffect(() => {
        const initializePage = async () => {
            try {
                const config = await loadConfig()
                if (isEditMode) {
                    const rule = await loadRule()
                    setupEditMode(rule)
                } else {
                    setupCreateMode(config)
                }
            } catch (error) {
                setPageState(prev => ({ ...prev, status: PageStatus.Error }))
            }
        }

        initializePage()
    }, [])

    const loadConfig = async () => {
        const result = await fetchSessionTargetingConfigFromServer(params.appId)

        if (result.status === SessionTargetingConfigApiStatus.Error) {
            throw new Error('Failed to load session targeting config')
        }

        const config = result.data
        setPageState(prev => ({ ...prev, config }))
        return config
    }

    const loadRule = async () => {
        if (!params.ruleId) {
            throw new Error('Failed to load session targeting rule: missing rule ID')
        }

        const result = await fetchSessionTargetingRuleFromServer(params.appId, params.ruleId)

        if (result.status === SessionTargetingRuleApiStatus.Error) {
            throw new Error('Failed to load session targeting rule')
        }

        const rule = result.data
        setPageState(prev => ({ ...prev, ruleResponse: rule }))
        return rule
    }

    const setupCreateMode = (config: SessionTargetingConfigResponse) => {
        setInitialRuleState(emptyRuleState)
        setPageState(prev => ({
            ...prev,
            status: PageStatus.Ready
        }))
    }

    const setupEditMode = (ruleResponse: SessionTargetingRuleResponse) => {
        const ruleData = ruleResponse
        const conditions = celToConditions(ruleData.rule)

        const eventConditions = conditions?.event
            ? conditions?.event
            : { conditions: [], operators: [] }

        const sessionConditions = conditions?.session
            ? conditions?.session
            : { conditions: [], operators: [] }

        const newRuleState: RuleState = {
            name: ruleData.name || '',
            samplingRate: String(ruleData.sampling_rate || 100),
            status: ruleData.status === 1 ? 'enabled' : 'disabled',
            eventConditions: eventConditions,
            sessionConditions: sessionConditions
        }

        setRuleState(newRuleState)
        setInitialRuleState(newRuleState)
        setPageState(prev => ({
            ...prev,
            status: PageStatus.Ready
        }))
    }


    const handleTitleChange = (name: string) => {
        setRuleState(prev => ({ ...prev, name }))
        setPageState(prev => ({
            ...prev,
        }))
    }

    const handleSamplingRateChange = (value: string) => {
        // Store raw input value to allow intermediate states
        setRuleState(prev => ({ ...prev, samplingRate: value }))
    }

    const handleSamplingRateBlur = (value: string) => {
        // Format and validate on blur
        const formattedValue = formatSamplingRate(value)
        setRuleState(prev => ({ ...prev, samplingRate: formattedValue }))
    }

    const handleStatusChange = (enabled: boolean) => {
        setRuleState(prev => ({ ...prev, status: enabled ? 'enabled' : 'disabled' }))
    }

    const addEventCondition = () => {
        if (!pageState.config || ruleState.eventConditions.conditions.length >= MAX_CONDITIONS) return

        const eventTypes = getEventTypesFromResponse(pageState.config)
        if (eventTypes.length === 0) return

        const newCondition = createEmptyEventCondition(eventTypes[0])

        const newOperators = ruleState.eventConditions.conditions.length > 0
            ? [...ruleState.eventConditions.operators, 'AND' as const]
            : []

        setRuleState(prev => ({
            ...prev,
            eventConditions: {
                conditions: [...ruleState.eventConditions.conditions, newCondition],
                operators: newOperators
            }
        }))
    }

    const removeEventCondition = (conditionId: string) => {
        const conditionIndex = ruleState.eventConditions.conditions.findIndex(c => c.id === conditionId)
        if (conditionIndex === -1) return

        const newConditions = ruleState.eventConditions.conditions.filter(c => c.id !== conditionId)
        const newOperators = removeOperatorAtIndex(ruleState.eventConditions.operators, conditionIndex)

        setRuleState(prev => ({
            ...prev,
            eventConditions: {
                conditions: newConditions,
                operators: newOperators
            }
        }))
    }

    const updateEventCondition = (conditionId: string, type: string) => {
        const updatedConditions = ruleState.eventConditions.conditions.map((condition) =>
            condition.id === conditionId
                ? { ...condition, type, attrs: [], ud_attrs: [] }
                : condition
        )

        setRuleState(prev => ({
            ...prev,
            eventConditions: {
                ...ruleState.eventConditions,
                conditions: updatedConditions
            }
        }))
    }

    const updateEventOperator = (operatorIndex: number, operator: 'AND' | 'OR') => {
        const newOperators = [...ruleState.eventConditions.operators]
        newOperators[operatorIndex] = operator

        setRuleState(prev => ({
            ...prev,
            eventConditions: {
                ...ruleState.eventConditions,
                operators: newOperators
            }
        }))
    }

    const addAttribute = (conditionId: string, attrType: AttrType) => {
        const condition = ruleState.eventConditions.conditions.find(c => c.id === conditionId)
        if (!condition || !condition.type || !pageState.config) return

        const availableAttrs = getAvailableAttributes(pageState.config, condition.type, attrType)
        if (!canAddMoreAttributes(condition, availableAttrs, attrType)) return

        const firstAttr = availableAttrs[0]
        if (!firstAttr) return

        const newAttr = createDefaultAttribute(firstAttr)

        const updatedConditions = ruleState.eventConditions.conditions.map((cond) =>
            cond.id === conditionId
                ? {
                    ...cond,
                    [attrType]: cond[attrType] ? [...cond[attrType]!, newAttr] : [newAttr]
                }
                : cond
        )

        setRuleState(prev => ({
            ...prev,
            eventConditions: {
                ...ruleState.eventConditions,
                conditions: updatedConditions
            }
        }))
    }

    const removeAttribute = (conditionId: string, attrId: string, attrType: AttrType) => {
        const condition = ruleState.eventConditions.conditions.find(c => c.id === conditionId)
        const currentAttrs = condition?.[attrType]
        if (!currentAttrs) return

        const updatedAttrs = currentAttrs.filter((attr) => attr.id !== attrId)

        const updatedConditions = ruleState.eventConditions.conditions.map((cond) =>
            cond.id === conditionId
                ? { ...cond, [attrType]: updatedAttrs.length > 0 ? updatedAttrs : null }
                : cond
        )

        setRuleState(prev => ({
            ...prev,
            eventConditions: {
                ...ruleState.eventConditions,
                conditions: updatedConditions
            }
        }))
    }

    const updateAttribute = (
        conditionId: string,
        attrId: string,
        field: 'key' | 'type' | 'value' | 'operator',
        value: any,
        attrType: AttrType
    ) => {
        if (!pageState.config) return

        const condition = ruleState.eventConditions.conditions.find(c => c.id === conditionId)
        const currentAttrs = condition?.[attrType]
        if (!currentAttrs) return

        const updatedAttrs = currentAttrs.map((attr) => {
            if (attr.id === attrId) {
                const updatedAttr = { ...attr, [field]: value }

                if (field === 'key') {
                    const availableAttrs = getAvailableAttributes(pageState.config!, condition.type, attrType)
                    const selectedAttr = availableAttrs.find(a => a.key === value)
                    if (selectedAttr) {
                        updatedAttr.type = selectedAttr.type
                        updatedAttr.value = selectedAttr.type === 'boolean' ? false : ''
                        updatedAttr.operator = getDefaultOperatorForType(selectedAttr.type)
                        updatedAttr.hint = selectedAttr.hint
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

        const updatedConditions = ruleState.eventConditions.conditions.map((cond) =>
            cond.id === conditionId
                ? { ...cond, [attrType]: updatedAttrs }
                : cond
        )

        setRuleState(prev => ({
            ...prev,
            eventConditions: {
                ...ruleState.eventConditions,
                conditions: updatedConditions
            }
        }))
    }

    const addSessionCondition = () => {
        if (!pageState.config || ruleState.sessionConditions.conditions.length >= MAX_CONDITIONS) return

        const sessionAttrs = getSessionAttributes(pageState.config)
        const newCondition = createEmptySessionCondition()

        if (sessionAttrs.length > 0) {
            const firstAttr = sessionAttrs[0]
            newCondition.attrs = [createDefaultAttribute(firstAttr)]
        }

        const newOperators = ruleState.sessionConditions.conditions.length > 0
            ? [...ruleState.sessionConditions.operators, 'AND' as const]
            : []

        setRuleState(prev => ({
            ...prev,
            sessionConditions: {
                conditions: [...ruleState.sessionConditions.conditions, newCondition],
                operators: newOperators
            }
        }))
    }

    const removeSessionCondition = (conditionId: string) => {
        const conditionIndex = ruleState.sessionConditions.conditions.findIndex(c => c.id === conditionId)
        if (conditionIndex === -1) return

        const newConditions = ruleState.sessionConditions.conditions.filter(c => c.id !== conditionId)
        const newOperators = removeOperatorAtIndex(ruleState.sessionConditions.operators, conditionIndex)

        setRuleState(prev => ({
            ...prev,
            sessionConditions: {
                conditions: newConditions,
                operators: newOperators
            }
        }))
    }

    const updateSessionOperator = (operatorIndex: number, operator: 'AND' | 'OR') => {
        const newOperators = [...ruleState.sessionConditions.operators]
        newOperators[operatorIndex] = operator

        setRuleState(prev => ({
            ...prev,
            sessionConditions: {
                ...ruleState.sessionConditions,
                operators: newOperators
            }
        }))
    }

    const updateSessionAttribute = (
        conditionId: string,
        attrId: string,
        field: 'key' | 'type' | 'value' | 'operator',
        value: any
    ) => {
        if (!pageState.config) return

        const condition = ruleState.sessionConditions.conditions.find(c => c.id === conditionId)
        const currentAttrs = condition?.attrs
        if (!currentAttrs) return

        const updatedAttrs = currentAttrs.map((attr) => {
            if (attr.id === attrId) {
                const updatedAttr = { ...attr, [field]: value }

                if (field === 'key') {
                    const sessionAttrs = getSessionAttributes(pageState.config!)
                    const selectedAttr = sessionAttrs.find(a => a.key === value)
                    if (selectedAttr) {
                        updatedAttr.type = selectedAttr.type
                        updatedAttr.value = selectedAttr.type === 'bool' ? false : ''
                        updatedAttr.operator = getDefaultOperatorForType(selectedAttr.type)
                        updatedAttr.hint = selectedAttr.hint
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

        const updatedConditions = ruleState.sessionConditions.conditions.map((cond) =>
            cond.id === conditionId
                ? { ...cond, attrs: updatedAttrs }
                : cond
        )

        setRuleState(prev => ({
            ...prev,
            sessionConditions: {
                ...ruleState.sessionConditions,
                conditions: updatedConditions
            }
        }))
    }

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
        operator: getDefaultOperatorForType(attrConfig.type),
        hint: attrConfig.hint,
    })

    const handleSubmit = async () => {
        // Validate all attributes
        const { eventConditions: validatedEventConditions, sessionConditions: validatedSessionConditions } =
            validateAllAttributes(ruleState.eventConditions, ruleState.sessionConditions);

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
        setRuleState(prev => ({
            ...prev,
            eventConditions: validatedEventConditions,
            sessionConditions: validatedSessionConditions
        }));

        // If there are validation errors, show toast and stop submission
        if (hasAttributeErrors) {
            toastNegative(`Please complete the required fields and try again.`);
            return;
        }

        const ruleCel = conditionsToCel({
            event: ruleState.eventConditions,
            trace: undefined,
            session: ruleState.sessionConditions
        })

        if (!ruleCel) {
            return
        }

        const ruleData = {
            name: ruleState.name,
            status: ruleState.status === 'enabled' ? 1 : 0,
            sampling_rate: parseSamplingRateForSubmission(ruleState.samplingRate),
            rule: ruleCel,
        }

        setSaveRuleState(prev => ({ ...prev, isSubmitting: true }));

        try {
            const result = isEditMode
                ? await updateSessionTargetingRule(params.appId, pageState.ruleResponse!.id, ruleData)
                : await createSessionTargetingRule(params.appId, ruleData)

            if (result.status === CreateSessionTargetingRuleApiStatus.Success ||
                result.status === UpdateSessionTargetingRuleApiStatus.Success) {
                toastPositive(isEditMode ? 'Rule updated successfully' : 'Rule published successfully')
                router.replace(`/${params.teamId}/session_targeting`)
            } else {
                toastNegative('Failed to save rule. Please try again.')
            }
        } catch (error) {
            toastNegative('Failed to save rule. Please try again.')
        } finally {
            setSaveRuleState(prev => ({ ...prev, isSubmitting: false }));
        }
    }

    if (pageState.status === PageStatus.Error) {
        return (
            <div className="flex flex-col selection:bg-yellow-200/75 items-start">
                <p className="text-lg font-display">
                    Error loading rule. Please refresh the page to try again.
                </p>
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

                    {/* Loading state */}
                    {pageState.status === PageStatus.Loading && (
                        <LoadingSpinner />
                    )}

                    {/* Rule name, status and sampling rate */}
                    {pageState.status === PageStatus.Ready && (
                        <>
                            <div className="grid gap-y-8 items-center max-w-2xl" style={{ gridTemplateColumns: '120px 1fr' }}>
                                <p className="text-sm">Rule name</p>
                                <input
                                    type="text"
                                    placeholder="Enter rule name"
                                    value={ruleState.name}
                                    maxLength={MAX_RULE_NAME_LENGTH}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    className={`w-96 border rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400 'border-black'
                                        }`}
                                />
                                <p className="text-sm">Sampling rate %</p>
                                <div className="flex items-center">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="0-100%"
                                        value={ruleState.samplingRate}
                                        min="0"
                                        max="100"
                                        step="0.000001"
                                        onChange={(e) => handleSamplingRateChange(e.target.value)}
                                        onBlur={(e) => handleSamplingRateBlur(e.target.value)}
                                        className="w-48 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400"
                                    />
                                </div>
                                <p className="text-sm">Active</p>
                                <div className="flex items-center">
                                    <Switch
                                        className={"data-[state=checked]:bg-emerald-500"}
                                        disabled={false}
                                        checked={ruleState.status === 'enabled'}
                                        onCheckedChange={handleStatusChange}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <SaveSessionTargetingRule
                    isEditMode={isEditMode}
                    isDisabled={!isFormValid || pageState.status !== PageStatus.Ready || !hasUnsavedChanges}
                    isLoading={saveRuleState.isSubmitting}
                    onPublish={handleSubmit}
                    onUpdate={handleSubmit}
                />
            </div>

            <div className="py-8" />

            {/* Main sampling conditions UI */}
            {pageState.status == PageStatus.Ready && (
                <div className="w-full space-y-4">
                    <div className="w-full space-y-4">
                        {/* Event conditions */}
                        <RuleBuilderConditionSection
                            title="Event Conditions"
                            conditionCount={ruleState.eventConditions.conditions.length}
                            maxConditions={MAX_CONDITIONS}
                            onAddCondition={addEventCondition}
                        >
                            {ruleState.eventConditions.conditions.length > 0 && (
                                <div className="pt-1">
                                    {ruleState.eventConditions.conditions.map((condition, index) => {
                                        const availableAttrs = condition.type && pageState.config ? getEventAttributes(pageState.config, condition.type) : []
                                        const canAddMoreAttrs = canAddMoreAttributes(condition, availableAttrs, 'attrs')
                                        const userDefinedAttrs = pageState.config ? getUserDefinedAttributes(pageState.config) : []
                                        const canAddMoreUdAttrs = canAddMoreAttributes(condition, userDefinedAttrs, 'ud_attrs')
                                        const supportsUdAttrs = pageState.config && condition.type ? doesEventSupportUdAttrs(pageState.config, condition.type) : false

                                        return (
                                            <div key={condition.id}>
                                                <RuleBuilderEventCondition
                                                    condition={condition}
                                                    eventTypes={eventTypes}
                                                    availableAttrs={availableAttrs}
                                                    userDefinedAttrs={userDefinedAttrs}
                                                    operatorTypesMapping={operatorTypesMapping}
                                                    canAddMoreAttrs={canAddMoreAttrs}
                                                    canAddMoreUdAttrs={canAddMoreUdAttrs}
                                                    supportsUdAttrs={supportsUdAttrs}
                                                    onUpdateEventType={updateEventCondition}
                                                    onRemoveCondition={removeEventCondition}
                                                    onAddAttribute={addAttribute}
                                                    onUpdateAttr={updateAttribute}
                                                    onRemoveAttr={removeAttribute}
                                                    getOperatorsForType={getOperatorsForType}
                                                />

                                                {index < ruleState.eventConditions.conditions.length - 1 && (
                                                    <div className="flex justify-center">
                                                        <RuleBuilderLogicalOperator
                                                            value={ruleState.eventConditions.operators[index] || 'AND'}
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
                            conditionCount={ruleState.sessionConditions.conditions.length}
                            maxConditions={MAX_CONDITIONS}
                            onAddCondition={addSessionCondition}
                        >
                            {ruleState.sessionConditions.conditions.length > 0 && (
                                <div className="pt-1">
                                    {ruleState.sessionConditions.conditions.map((condition, index) => (
                                        <div key={condition.id}>
                                            <RuleBuilderSessionCondition
                                                condition={condition}
                                                sessionAttrs={sessionAttrs}
                                                operatorTypesMapping={operatorTypesMapping}
                                                onRemoveCondition={removeSessionCondition}
                                                onUpdateAttr={updateSessionAttribute}
                                                getOperatorsForType={getOperatorsForType}
                                            />

                                            {index < ruleState.sessionConditions.conditions.length - 1 && (
                                                <div className="flex justify-center">
                                                    <RuleBuilderLogicalOperator
                                                        value={ruleState.sessionConditions.operators[index] || 'AND'}
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