"use client"

import { emptySamplingRulesConfigResponse, fetchSamplingRulesConfigFromServer, SamplingRulesConfigApiStatus, fetchSamplingRuleFromServer, SamplingRuleApiStatus, emptySamplingRuleResponse, createSamplingRule, CreateSamplingRuleApiStatus, updateSamplingRule, UpdateSamplingRuleApiStatus } from '@/app/api/api_calls';
import { Button } from '@/app/components/button';
import LoadingSpinner from '@/app/components/loading_spinner';
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select';
import SamplingAttributeRow from '@/app/components/sampling_attribute_row';
import SamplingLogicalOperatorSelector from '@/app/components/sampling_logical_operator_selector';
import SamplingEditableTitle from '@/app/components/sampling_editable_title';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { EventCondition, SessionCondition, TraceCondition, EventConditions, SessionConditions, TraceConditions } from '@/app/utils/cel-types';
import { generateEventRuleCel, generateTraceRuleCel, generateSessionRuleCel, getDefaultOperatorForType } from '@/app/utils/cel-utils';

export type SamplingRulesConfig = typeof emptySamplingRulesConfigResponse;
const MAX_CONDITIONS = 5;
const MAX_ATTRIBUTES_PER_CONDITION = 10;

interface SamplingRateState {
    value: string | number;
}

interface PageState {
    samplingRulesConfigApiStatus: SamplingRulesConfigApiStatus
    samplingRulesConfig: typeof emptySamplingRulesConfigResponse
    samplingRuleApiStatus: SamplingRuleApiStatus
    samplingRule: typeof emptySamplingRuleResponse
}

interface SamplingRulePageProps {
    params: {
        teamId: string;
        appId: string;
        type: string; // "trace" or "session"
        ruleId?: string; // Only present for edit mode
        ruleName?: string; // Only present for edit mode
    };
    isEditMode: boolean;
}

type AttributeType = 'attrs' | 'udAttrs';

const createEmptyEventCondition = (): EventCondition => ({
    type: null,
    attrs: null,
    udAttrs: null
})

const createEmptySessionCondition = (): SessionCondition => ({
    attrs: null
})

const createEmptyTraceCondition = (): TraceCondition => ({
    spanName: null,
    udAttrs: null
})

export const getEventTypesFromResponse = (response: typeof emptySamplingRulesConfigResponse) => {
    return response.result?.events?.map(event => event.type) || [];
};

const getEventAttributes = (response: typeof emptySamplingRulesConfigResponse, eventType: string) => {
    const event = response.result?.events?.find(e => e.type === eventType);
    return event?.attrs || [];
};

const getSessionAttributes = (response: typeof emptySamplingRulesConfigResponse) => {
    return response.result?.session_attrs || [];
};

const doesEventSupportUdAttrs = (response: typeof emptySamplingRulesConfigResponse, eventType: string): boolean => {
    const event = response.result?.events?.find(e => e.type === eventType);
    return event?.ud_attrs === true;
};

const getUserDefinedAttributes = (response: typeof emptySamplingRulesConfigResponse) => {
    return response.result?.event_ud_attrs?.key_types || [];
};

const getSpanNamesFromResponse = (response: typeof emptySamplingRulesConfigResponse) => {
    return response.result?.spans?.map(span => span.name) || [];
};

const getSpanUserDefinedAttributes = (response: typeof emptySamplingRulesConfigResponse) => {
    return response.result?.span_ud_attrs?.key_types || [];
};

const getOperatorTypesMapping = (response: typeof emptySamplingRulesConfigResponse) => {
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
    if (attributeType === 'udAttrs' && 'udAttrs' in condition) {
        const currentAttrs = condition.udAttrs;
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
    samplingRulesConfig: typeof emptySamplingRulesConfigResponse,
    eventType: string | null,
    attributeType: AttributeType
) => {
    if (attributeType === 'attrs' && eventType) {
        return getEventAttributes(samplingRulesConfig, eventType);
    } else if (attributeType === 'udAttrs' && eventType) {
        if (doesEventSupportUdAttrs(samplingRulesConfig, eventType)) {
            return getUserDefinedAttributes(samplingRulesConfig);
        }
        return [];
    }
    return [];
};

// Loading state helper functions
const isPageLoading = (pageState: PageState, isEditMode: boolean): boolean => {
    return pageState.samplingRulesConfigApiStatus === SamplingRulesConfigApiStatus.Loading ||
        (isEditMode && pageState.samplingRuleApiStatus === SamplingRuleApiStatus.Loading);
};

const hasPageError = (pageState: PageState, isEditMode: boolean): boolean => {
    return pageState.samplingRulesConfigApiStatus === SamplingRulesConfigApiStatus.Error ||
        (isEditMode && pageState.samplingRuleApiStatus === SamplingRuleApiStatus.Error);
};

const isPageReady = (pageState: PageState, isEditMode: boolean): boolean => {
    return pageState.samplingRulesConfigApiStatus === SamplingRulesConfigApiStatus.Success &&
        (!isEditMode || pageState.samplingRuleApiStatus === SamplingRuleApiStatus.Success);
};

// Helper function to check if conditions are empty
const areConditionsEmpty = (
    type: string,
    eventConditionsState: EventConditions,
    sessionConditionsState: SessionConditions,
    traceConditionsState?: TraceConditions
): boolean => {
    if (type === 'trace') {
        // For trace rules, check trace conditions and session conditions
        const hasValidTraceConditions = traceConditionsState?.conditions.some(condition => {
            return condition.spanName !== null ||
                (condition.udAttrs && condition.udAttrs.length > 0);
        });

        const hasValidSessionConditions = sessionConditionsState.conditions.some(condition => {
            return condition.attrs && condition.attrs.length > 0;
        });

        return !hasValidTraceConditions && !hasValidSessionConditions;
    } else {
        // For event rules, check event conditions and session conditions  
        const hasValidEventConditions = eventConditionsState.conditions.some(condition => {
            return condition.type !== null ||
                (condition.attrs && condition.attrs.length > 0) ||
                (condition.udAttrs && condition.udAttrs.length > 0);
        });

        const hasValidSessionConditions = sessionConditionsState.conditions.some(condition => {
            return condition.attrs && condition.attrs.length > 0;
        });

        return !hasValidEventConditions && !hasValidSessionConditions;
    }
};

export default function SamplingRulePage({ params, isEditMode }: SamplingRulePageProps) {
    const router = useRouter()
    const type = params.type
    const nameFromParams = isEditMode && params.ruleName ? decodeURIComponent(params.ruleName) : null

    const initialState: PageState = {
        samplingRulesConfigApiStatus: SamplingRulesConfigApiStatus.Loading,
        samplingRulesConfig: emptySamplingRulesConfigResponse,
        samplingRuleApiStatus: SamplingRuleApiStatus.Loading,
        samplingRule: emptySamplingRuleResponse,
    }

    const [pageState, setPageState] = useState<PageState>(initialState)
    const [samplingRuleName, setSamplingRuleName] = useState<string | null>(nameFromParams)
    const [eventConditionsState, setEventConditionsState] = useState<EventConditions>({
        conditions: [createEmptyEventCondition()],
        operators: []
    })
    const [sessionConditionsState, setSessionConditionsState] = useState<SessionConditions>({
        conditions: [],
        operators: []
    })
    const [traceConditionsState, setTraceConditionsState] = useState<TraceConditions>({
        conditions: [createEmptyTraceCondition()],
        operators: []
    })
    const [samplingRateState, setSamplingRateState] = useState<SamplingRateState>({
        value: 100
    });
    const [samplingRuleStatus, setSamplingRuleStatus] = useState<'enabled' | 'disabled'>('enabled'); // TODO: handle status change

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const getSamplingRulesConfig = async () => {
        updatePageState({ samplingRulesConfigApiStatus: SamplingRulesConfigApiStatus.Loading })
        const result = await fetchSamplingRulesConfigFromServer(params.teamId, params.appId)

        switch (result.status) {
            case SamplingRulesConfigApiStatus.Error:
                updatePageState({ samplingRulesConfigApiStatus: SamplingRulesConfigApiStatus.Error })
                break
            case SamplingRulesConfigApiStatus.Success:
                updatePageState({
                    samplingRulesConfigApiStatus: SamplingRulesConfigApiStatus.Success,
                    samplingRulesConfig: result.data
                })
                break
        }
    }

    const getSamplingRule = async () => {
        if (!isEditMode) {
            // For create mode, just mark as success
            updatePageState({ samplingRuleApiStatus: SamplingRuleApiStatus.Success })
            return
        }

        if (!params.ruleId) {
            updatePageState({ samplingRuleApiStatus: SamplingRuleApiStatus.Error })
            return
        }

        updatePageState({ samplingRuleApiStatus: SamplingRuleApiStatus.Loading })
        const result = await fetchSamplingRuleFromServer(params.teamId, params.appId, params.ruleId)

        switch (result.status) {
            case SamplingRuleApiStatus.Error:
                updatePageState({ samplingRuleApiStatus: SamplingRuleApiStatus.Error })
                break
            case SamplingRuleApiStatus.Success:
                updatePageState({
                    samplingRuleApiStatus: SamplingRuleApiStatus.Success,
                    samplingRule: result.data
                })
                break
        }
    }

    useEffect(() => {
        getSamplingRulesConfig()
    }, [])

    useEffect(() => {
        if (isEditMode && pageState.samplingRulesConfigApiStatus === SamplingRulesConfigApiStatus.Success) {
            getSamplingRule()
        }
    }, [isEditMode, pageState.samplingRulesConfigApiStatus])

    // Effect to populate title and sampling rate when rule data is loaded
    useEffect(() => {
        if (isEditMode && pageState.samplingRuleApiStatus === SamplingRuleApiStatus.Success && pageState.samplingRule.results) {
            const ruleData = pageState.samplingRule.results

            if (ruleData.name) {
                setSamplingRuleName(ruleData.name)
            }
            if (typeof ruleData.sampling_rate === 'number') {
                setSamplingRateState({ value: ruleData.sampling_rate * 100 })
            }
        }
    }, [isEditMode, pageState.samplingRuleApiStatus, pageState.samplingRule])

    // Effect to set the first event type when eventTypes are available
    useEffect(() => {
        const eventTypes = getEventTypesFromResponse(pageState.samplingRulesConfig);

        if (eventTypes.length > 0 && type !== 'trace') {
            setEventConditionsState(prevState => {
                // Only update if the first condition doesn't have a type set
                if (prevState.conditions.length > 0 && prevState.conditions[0].type === null) {
                    const updatedConditions = prevState.conditions.map((condition, index) =>
                        index === 0 ? { ...condition, type: eventTypes[0] } : condition
                    );
                    return {
                        ...prevState,
                        conditions: updatedConditions
                    };
                }
                return prevState;
            });
        }
    }, [pageState.samplingRulesConfig, type]);

    // Effect to set the first span name when span names are available
    useEffect(() => {
        const spanNames = getSpanNamesFromResponse(pageState.samplingRulesConfig);

        if (spanNames.length > 0 && type === 'trace') {
            setTraceConditionsState(prevState => {
                // Only update if the first condition doesn't have a span name set
                if (prevState.conditions.length > 0 && prevState.conditions[0].spanName === null) {
                    const updatedConditions = prevState.conditions.map((condition, index) =>
                        index === 0 ? { ...condition, spanName: spanNames[0] } : condition
                    );
                    return {
                        ...prevState,
                        conditions: updatedConditions
                    };
                }
                return prevState;
            });
        }
    }, [pageState.samplingRulesConfig, type]);

    const handleTitleChange = (title: string) => {
        setSamplingRuleName(title);
    };

    // Event condition handlers
    const addEventCondition = () => {
        if (eventConditionsState.conditions.length < MAX_CONDITIONS) {
            const eventTypes = getEventTypesFromResponse(pageState.samplingRulesConfig);
            const newCondition = createEmptyEventCondition();

            // Set the first event type if available
            if (eventTypes.length > 0) {
                newCondition.type = eventTypes[0];
            }

            const newOperators = eventConditionsState.conditions.length > 0
                ? [...eventConditionsState.operators, 'AND' as const]
                : []

            setEventConditionsState({
                conditions: [...eventConditionsState.conditions, newCondition],
                operators: newOperators
            })
        }
    }

    const removeEventCondition = (conditionIndex: number) => {
        if (conditionIndex < 0 || conditionIndex >= eventConditionsState.conditions.length) return

        const newConditions = eventConditionsState.conditions.filter((_, index) => index !== conditionIndex)
        let newOperators = [...eventConditionsState.operators]

        if (conditionIndex < newOperators.length) {
            newOperators.splice(conditionIndex, 1)
        } else if (conditionIndex > 0 && newOperators.length > 0) {
            newOperators.splice(conditionIndex - 1, 1)
        }

        setEventConditionsState({
            conditions: newConditions,
            operators: newOperators
        })
    }

    const updateEventCondition = (conditionIndex: number, type: string) => {
        if (conditionIndex < 0 || conditionIndex >= eventConditionsState.conditions.length) return

        const updatedConditions = eventConditionsState.conditions.map((condition, index) =>
            index === conditionIndex
                ? { ...condition, type, attrs: null, udAttrs: null }
                : condition
        )
        setEventConditionsState({
            ...eventConditionsState,
            conditions: updatedConditions
        })
    }

    const updateEventOperator = (operatorIndex: number, operator: 'AND' | 'OR') => {
        const newOperators = [...eventConditionsState.operators]
        newOperators[operatorIndex] = operator
        setEventConditionsState({
            ...eventConditionsState,
            operators: newOperators
        })
    }

    const addAttribute = (conditionIndex: number, attributeType: AttributeType) => {
        const condition = eventConditionsState.conditions[conditionIndex]
        if (!condition || !condition.type) return

        const availableAttrs = getAvailableAttributes(pageState.samplingRulesConfig, condition.type, attributeType)
        if (!canAddMoreAttributes(condition, availableAttrs, attributeType)) return

        const firstAttr = availableAttrs[0];
        if (!firstAttr) return;

        const newAttr = {
            key: firstAttr.key,
            type: firstAttr.type,
            value: firstAttr.type === 'bool' ? false : '',
            operator: getDefaultOperatorForType(firstAttr.type)
        }

        setEventConditionsState(prevState => {
            const updatedConditions = prevState.conditions.map((cond, index) =>
                index === conditionIndex
                    ? {
                        ...cond,
                        [attributeType]: cond[attributeType] ? [...cond[attributeType]!, newAttr] : [newAttr]
                    }
                    : cond
            )
            return {
                ...prevState,
                conditions: updatedConditions
            }
        })
    }

    const removeAttribute = (conditionIndex: number, attrIndex: number, attributeType: AttributeType) => {
        setEventConditionsState(prevState => {
            const condition = prevState.conditions[conditionIndex]
            const currentAttrs = condition?.[attributeType]
            if (!currentAttrs) return prevState

            const updatedAttrs = currentAttrs.filter((_, index) => index !== attrIndex)

            const updatedConditions = prevState.conditions.map((cond, index) =>
                index === conditionIndex
                    ? { ...cond, [attributeType]: updatedAttrs.length > 0 ? updatedAttrs : null }
                    : cond
            )

            return {
                ...prevState,
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
        setEventConditionsState(prevState => {
            const condition = prevState.conditions[conditionIndex]
            const currentAttrs = condition?.[attributeType]
            if (!currentAttrs) return prevState

            const updatedAttrs = currentAttrs.map((attr, index) => {
                if (index === attrIndex) {
                    const updatedAttr = { ...attr, [field]: value }

                    if (field === 'key') {
                        const availableAttrs = getAvailableAttributes(pageState.samplingRulesConfig, condition.type, attributeType)
                        const selectedAttr = availableAttrs.find(a => a.key === value)
                        if (selectedAttr) {
                            updatedAttr.type = selectedAttr.type
                            updatedAttr.value = selectedAttr.type === 'boolean' ? false : ''
                            updatedAttr.operator = getDefaultOperatorForType(selectedAttr.type)
                        }
                    }

                    return updatedAttr
                }
                return attr
            })

            const updatedConditions = prevState.conditions.map((cond, index) =>
                index === conditionIndex
                    ? { ...cond, [attributeType]: updatedAttrs }
                    : cond
            )

            return {
                ...prevState,
                conditions: updatedConditions
            }
        })
    }

    // Session condition handlers
    const addSessionCondition = () => {
        if (sessionConditionsState.conditions.length < MAX_CONDITIONS) {
            const sessionAttrs = getSessionAttributes(pageState.samplingRulesConfig)
            const newCondition = createEmptySessionCondition()

            if (sessionAttrs.length > 0) {
                const firstAttr = sessionAttrs[0]
                newCondition.attrs = [{
                    key: firstAttr.key,
                    type: firstAttr.type,
                    value: firstAttr.type === 'bool' ? false : '',
                    operator: getDefaultOperatorForType(firstAttr.type)
                }]
            }

            const newOperators = sessionConditionsState.conditions.length > 0
                ? [...sessionConditionsState.operators, 'AND' as const]
                : []

            setSessionConditionsState({
                conditions: [...sessionConditionsState.conditions, newCondition],
                operators: newOperators
            })
        }
    }

    const removeSessionCondition = (conditionIndex: number) => {
        if (conditionIndex < 0 || conditionIndex >= sessionConditionsState.conditions.length) return

        const newConditions = sessionConditionsState.conditions.filter((_, index) => index !== conditionIndex)
        let newOperators = [...sessionConditionsState.operators]

        if (conditionIndex < newOperators.length) {
            newOperators.splice(conditionIndex, 1)
        } else if (conditionIndex > 0 && newOperators.length > 0) {
            newOperators.splice(conditionIndex - 1, 1)
        }

        setSessionConditionsState({
            conditions: newConditions,
            operators: newOperators
        })
    }

    const updateSessionOperator = (operatorIndex: number, operator: 'AND' | 'OR') => {
        const newOperators = [...sessionConditionsState.operators]
        newOperators[operatorIndex] = operator
        setSessionConditionsState({
            ...sessionConditionsState,
            operators: newOperators
        })
    }

    const updateSessionAttribute = (
        conditionIndex: number,
        attrIndex: number,
        field: 'key' | 'type' | 'value' | 'operator',
        value: any
    ) => {
        setSessionConditionsState(prevState => {
            const condition = prevState.conditions[conditionIndex]
            const currentAttrs = condition?.attrs
            if (!currentAttrs) return prevState

            const updatedAttrs = currentAttrs.map((attr, index) => {
                if (index === attrIndex) {
                    const updatedAttr = { ...attr, [field]: value }

                    if (field === 'key') {
                        const sessionAttrs = getSessionAttributes(pageState.samplingRulesConfig)
                        const selectedAttr = sessionAttrs.find(a => a.key === value)
                        if (selectedAttr) {
                            updatedAttr.type = selectedAttr.type
                            updatedAttr.value = selectedAttr.type === 'bool' ? false : ''
                            updatedAttr.operator = getDefaultOperatorForType(selectedAttr.type)
                        }
                    }

                    return updatedAttr
                }
                return attr
            })

            const updatedConditions = prevState.conditions.map((cond, index) =>
                index === conditionIndex
                    ? { ...cond, attrs: updatedAttrs }
                    : cond
            )

            return {
                ...prevState,
                conditions: updatedConditions
            }
        })
    }

    // Trace condition handlers
    const addTraceCondition = () => {
        if (traceConditionsState.conditions.length < MAX_CONDITIONS) {
            const spanNames = getSpanNamesFromResponse(pageState.samplingRulesConfig);
            const newCondition = createEmptyTraceCondition();

            // Set the first span name if available
            if (spanNames.length > 0) {
                newCondition.spanName = spanNames[0];
            }

            const newOperators = traceConditionsState.conditions.length > 0
                ? [...traceConditionsState.operators, 'AND' as const]
                : []

            setTraceConditionsState({
                conditions: [...traceConditionsState.conditions, newCondition],
                operators: newOperators
            })
        }
    }

    const removeTraceCondition = (conditionIndex: number) => {
        if (conditionIndex < 0 || conditionIndex >= traceConditionsState.conditions.length) return

        const newConditions = traceConditionsState.conditions.filter((_, index) => index !== conditionIndex)
        let newOperators = [...traceConditionsState.operators]

        if (conditionIndex < newOperators.length) {
            newOperators.splice(conditionIndex, 1)
        } else if (conditionIndex > 0 && newOperators.length > 0) {
            newOperators.splice(conditionIndex - 1, 1)
        }

        setTraceConditionsState({
            conditions: newConditions,
            operators: newOperators
        })
    }

    const updateTraceCondition = (conditionIndex: number, spanName: string) => {
        if (conditionIndex < 0 || conditionIndex >= traceConditionsState.conditions.length) return

        const updatedConditions = traceConditionsState.conditions.map((condition, index) =>
            index === conditionIndex
                ? { ...condition, spanName, udAttrs: null }
                : condition
        )
        setTraceConditionsState({
            ...traceConditionsState,
            conditions: updatedConditions
        })
    }

    const updateTraceOperator = (operatorIndex: number, operator: 'AND' | 'OR') => {
        const newOperators = [...traceConditionsState.operators]
        newOperators[operatorIndex] = operator
        setTraceConditionsState({
            ...traceConditionsState,
            operators: newOperators
        })
    }

    const addTraceAttribute = (conditionIndex: number) => {
        const condition = traceConditionsState.conditions[conditionIndex]
        if (!condition || !condition.spanName) return

        const availableAttrs = getSpanUserDefinedAttributes(pageState.samplingRulesConfig)
        if (!availableAttrs.length) return

        const firstAttr = availableAttrs[0];
        if (!firstAttr) return;

        const newAttr = {
            key: firstAttr.key,
            type: firstAttr.type,
            value: firstAttr.type === 'bool' ? false : '',
            operator: getDefaultOperatorForType(firstAttr.type)
        }

        setTraceConditionsState(prevState => {
            const updatedConditions = prevState.conditions.map((cond, index) =>
                index === conditionIndex
                    ? {
                        ...cond,
                        udAttrs: cond.udAttrs ? [...cond.udAttrs, newAttr] : [newAttr]
                    }
                    : cond
            )
            return {
                ...prevState,
                conditions: updatedConditions
            }
        })
    }

    const removeTraceAttribute = (conditionIndex: number, attrIndex: number) => {
        setTraceConditionsState(prevState => {
            const condition = prevState.conditions[conditionIndex]
            const currentAttrs = condition?.udAttrs
            if (!currentAttrs) return prevState

            const updatedAttrs = currentAttrs.filter((_, index) => index !== attrIndex)

            const updatedConditions = prevState.conditions.map((cond, index) =>
                index === conditionIndex
                    ? { ...cond, udAttrs: updatedAttrs.length > 0 ? updatedAttrs : null }
                    : cond
            )

            return {
                ...prevState,
                conditions: updatedConditions
            }
        })
    }

    const updateTraceAttribute = (
        conditionIndex: number,
        attrIndex: number,
        field: 'key' | 'type' | 'value' | 'operator',
        value: any
    ) => {
        setTraceConditionsState(prevState => {
            const condition = prevState.conditions[conditionIndex]
            const currentAttrs = condition?.udAttrs
            if (!currentAttrs) return prevState

            const updatedAttrs = currentAttrs.map((attr, index) => {
                if (index === attrIndex) {
                    const updatedAttr = { ...attr, [field]: value }

                    if (field === 'key') {
                        const availableAttrs = getSpanUserDefinedAttributes(pageState.samplingRulesConfig)
                        const selectedAttr = availableAttrs.find(a => a.key === value)
                        if (selectedAttr) {
                            updatedAttr.type = selectedAttr.type
                            updatedAttr.value = selectedAttr.type === 'boolean' ? false : ''
                            updatedAttr.operator = getDefaultOperatorForType(selectedAttr.type)
                        }
                    }

                    return updatedAttr
                }
                return attr
            })

            const updatedConditions = prevState.conditions.map((cond, index) =>
                index === conditionIndex
                    ? { ...cond, udAttrs: updatedAttrs }
                    : cond
            )

            return {
                ...prevState,
                conditions: updatedConditions
            }
        })
    }

    const handleCreateSamplingRule = async () => {
        // Generate CEL expressions
        let eventRuleCel = null;
        let traceRuleCel = null;
        let sessionRuleCel = null;

        sessionRuleCel = generateSessionRuleCel(sessionConditionsState);
        if (type === 'trace') {
            traceRuleCel = generateTraceRuleCel(traceConditionsState, sessionConditionsState);
        } else {
            eventRuleCel = generateEventRuleCel(eventConditionsState, sessionConditionsState);
        }

        // Prepare rule data
        const ruleData = {
            type: type,
            name: samplingRuleName || '', // TODO: add validation
            status: 1,
            sampling_rate: Number(samplingRateState.value) / 100, // Convert percentage to decimal
            event_rule: eventRuleCel,
            trace_rule: traceRuleCel,
            session_rule: sessionRuleCel,
        };

        try {
            const result = await createSamplingRule(params.teamId, params.appId, ruleData);

            if (result.status === CreateSamplingRuleApiStatus.Success) {
                // TODO: Navigate to sampling rules list page
                router.push(`/teams/${params.teamId}/apps/${params.appId}/sampling-rules`);
            } else {
                // TODO: Show error
                console.error('Failed to create sampling rule:', result.error);
            }
        } catch (error) {
            console.error('Error creating sampling rule:', error);
        }
    }

    const handleUpdateSamplingRule = async () => {
        // Generate CEL expressions
        let eventRuleCel = null;
        let traceRuleCel = null;
        let sessionRuleCel = null;

        sessionRuleCel = generateSessionRuleCel(sessionConditionsState);
        if (type === 'trace') {
            traceRuleCel = generateTraceRuleCel(traceConditionsState, sessionConditionsState);
        } else {
            eventRuleCel = generateEventRuleCel(eventConditionsState, sessionConditionsState);
        }

        // Prepare rule data
        const ruleData = {
            id: params.ruleId || '', // TODO: add validation
            type: type,
            name: samplingRuleName || '', // TODO: add validation
            status: 1,
            sampling_rate: Number(samplingRateState.value) / 100, // Convert percentage to decimal
            event_rule: eventRuleCel,
            trace_rule: traceRuleCel,
            session_rule: sessionRuleCel,
        };

        try {
            const result = await updateSamplingRule(params.teamId, params.appId, ruleData.id, ruleData);

            if (result.status === UpdateSamplingRuleApiStatus.Success) {
                // TODO: Navigate to sampling rules list page
                router.push(`/teams/${params.teamId}/apps/${params.appId}/sampling-rules`);
            } else {
                // TODO: Show error
                console.error('Failed to create sampling rule:', result.error);
            }
        } catch (error) {
            console.error('Error creating sampling rule:', error);
        }
    }

    const eventTypes = getEventTypesFromResponse(pageState.samplingRulesConfig);
    const spanNames = getSpanNamesFromResponse(pageState.samplingRulesConfig);
    const operatorTypesMapping = getOperatorTypesMapping(pageState.samplingRulesConfig);
    const sessionAttrs = getSessionAttributes(pageState.samplingRulesConfig);
    const conditionsAreEmpty = areConditionsEmpty(type, eventConditionsState, sessionConditionsState, traceConditionsState);

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <div className="flex flex-row items-center gap-2 justify-between w-full">
                <SamplingEditableTitle
                    initialValue={samplingRuleName}
                    onTitleChange={handleTitleChange}
                    showEditButton={isPageReady(pageState, isEditMode)}
                    isLoading={isPageLoading(pageState, isEditMode)}
                />
                {/* Only show Publish button when all required data is loaded */}
                {isPageReady(pageState, isEditMode) && (
                    <Button
                        variant="outline"
                        className="font-display border border-black select-none"
                        disabled={conditionsAreEmpty}
                        onClick={() => {
                            if (isEditMode) {
                                // Update existing rule
                                handleUpdateSamplingRule();
                            } else {
                                // Create new rule
                                handleCreateSamplingRule();
                            }
                        }}
                    >
                        {isEditMode ? 'Update Rule' : 'Publish Rule'}
                    </Button>
                )}
            </div>
            <div className="py-4" />

            {/* Error state */}
            {hasPageError(pageState, isEditMode) && (
                <p className="text-lg font-display">
                    Error loading rule. Please refresh the page to try again.
                </p>
            )}

            {/* Loading state */}
            {isPageLoading(pageState, isEditMode) && (
                <LoadingSpinner />
            )}

            {/* Main sampling conditions UI */}
            {isPageReady(pageState, isEditMode) && (
                <div className="w-full space-y-6">

                    {/* Sampling rate */}
                    <div className="w-full">
                        <div className="flex justify-between">
                            <div className="flex items-center gap-2">
                                <p className="font-display text-xl max-w-6xl">Sampling rate</p>
                            </div>
                        </div>

                        <div className="pt-2">
                            <input
                                type="number"
                                placeholder="0-100"
                                value={samplingRateState.value}
                                min={0}
                                max={100}
                                onChange={(e) => {
                                    setSamplingRateState({ value: e.target.value });
                                }}
                                onBlur={(e) => {
                                    const val = Number(e.target.value);
                                    setSamplingRateState({
                                        value: Math.max(0, Math.min(100, isNaN(val) ? 0 : val))
                                    });
                                }}
                                className="w-16 my-2 border border-black rounded-md outline-hidden text-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-2 font-body placeholder:text-neutral-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            /> %
                        </div>
                    </div>

                    <div className="py-2" />

                    {/* Event conditions - only show for non-trace rules */}
                    {type !== 'trace' && (
                        <div className="w-full">
                            <div className="flex justify-start items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <p className="font-display text-xl max-w-6xl">Event conditions</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={addEventCondition}
                                    disabled={eventConditionsState.conditions.length >= MAX_CONDITIONS}
                                >
                                    + Add condition
                                </Button>
                            </div>

                            {eventConditionsState.conditions.length > 0 && (
                                <div className="pt-4">
                                    {eventConditionsState.conditions.map((condition, index) => {
                                        const availableAttrs = condition.type ? getEventAttributes(pageState.samplingRulesConfig, condition.type) : []
                                        const canAddMoreRegularAttrs = canAddMoreAttributes(condition, availableAttrs, 'attrs')
                                        const globalUserDefinedAttrs = getUserDefinedAttributes(pageState.samplingRulesConfig)
                                        const canAddMoreUdAttrs = canAddMoreAttributes(condition, globalUserDefinedAttrs, 'udAttrs')

                                        return (
                                            <div key={index}>
                                                <div className="bg-gray-50 p-3 space-y-6 rounded-lg border">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex flex-row items-center">
                                                            <p className="text-sm">Event Type</p>
                                                            <div className="px-3" />
                                                            <DropdownSelect
                                                                type={DropdownSelectType.SingleString}
                                                                title="Select Event Type"
                                                                items={eventTypes}
                                                                initialSelected={condition.type || ""}
                                                                onChangeSelected={(selected) => {
                                                                    updateEventCondition(index, selected as string)
                                                                }}
                                                            />
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeEventCondition(index)}
                                                            className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>

                                                    {(availableAttrs.length > 0 || (condition.type && doesEventSupportUdAttrs(pageState.samplingRulesConfig, condition.type) && globalUserDefinedAttrs.length > 0)) && (
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-3">
                                                                <p className="text-sm">Attributes</p>
                                                                {availableAttrs.length > 0 && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => addAttribute(index, 'attrs')}
                                                                        disabled={!canAddMoreRegularAttrs}
                                                                        className="text-xs"
                                                                    >
                                                                        + Add attribute
                                                                    </Button>
                                                                )}
                                                                {condition.type && doesEventSupportUdAttrs(pageState.samplingRulesConfig, condition.type) && globalUserDefinedAttrs.length > 0 && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => addAttribute(index, 'udAttrs')}
                                                                        disabled={!canAddMoreUdAttrs}
                                                                        className="text-xs"
                                                                    >
                                                                        + Add user-defined attribute
                                                                    </Button>
                                                                )}
                                                            </div>

                                                            {condition.attrs && condition.attrs.map((attr, attrIndex) => {
                                                                const operatorTypes = getOperatorsForType(operatorTypesMapping, attr.type)
                                                                const availableAttrKeys = availableAttrs.map(a => a.key);

                                                                return (
                                                                    <SamplingAttributeRow
                                                                        key={`attrs-${index}-${attrIndex}`}
                                                                        attr={attr}
                                                                        attrIndex={attrIndex}
                                                                        conditionIndex={index}
                                                                        attributeType="attrs"
                                                                        availableAttrKeys={availableAttrKeys}
                                                                        operatorTypes={operatorTypes}
                                                                        onUpdateAttribute={updateAttribute}
                                                                        onRemoveAttribute={removeAttribute}
                                                                    />
                                                                )
                                                            })}

                                                            {condition.udAttrs && condition.udAttrs.map((udAttr, udAttrIndex) => {
                                                                const operatorTypes = getOperatorsForType(operatorTypesMapping, udAttr.type)
                                                                const availableUdAttrKeys = globalUserDefinedAttrs.map(a => a.key);

                                                                return (
                                                                    <SamplingAttributeRow
                                                                        key={`udAttrs-${index}-${udAttrIndex}`}
                                                                        attr={udAttr}
                                                                        attrIndex={udAttrIndex}
                                                                        conditionIndex={index}
                                                                        attributeType="udAttrs"
                                                                        availableAttrKeys={availableUdAttrKeys}
                                                                        operatorTypes={operatorTypes}
                                                                        onUpdateAttribute={updateAttribute}
                                                                        onRemoveAttribute={removeAttribute}
                                                                    />
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {index < eventConditionsState.conditions.length - 1 && (
                                                    <div className="flex justify-start">
                                                        <SamplingLogicalOperatorSelector
                                                            value={eventConditionsState.operators[index] || 'AND'}
                                                            onChange={(operator) => updateEventOperator(index, operator)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Trace conditions - only show for trace rules */}
                    {type === 'trace' && (
                        <div className="w-full">
                            <div className="flex justify-start items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <p className="font-display text-xl max-w-6xl">Trace conditions</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={addTraceCondition}
                                    disabled={traceConditionsState.conditions.length >= MAX_CONDITIONS}
                                >
                                    + Add condition
                                </Button>
                            </div>

                            {traceConditionsState.conditions.length > 0 && (
                                <div className="pt-4">
                                    {traceConditionsState.conditions.map((condition, index) => {
                                        const spanUdAttrs = getSpanUserDefinedAttributes(pageState.samplingRulesConfig);
                                        const canAddMoreUdAttrs = condition.udAttrs ? condition.udAttrs.length < MAX_ATTRIBUTES_PER_CONDITION : true;

                                        return (
                                            <div key={index}>
                                                <div className="bg-gray-50 p-3 space-y-6 rounded-lg border">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex flex-row items-center">
                                                            <p className="text-sm">Span Name</p>
                                                            <div className="px-3" />
                                                            <DropdownSelect
                                                                type={DropdownSelectType.SingleString}
                                                                title="Select Span Name"
                                                                items={spanNames}
                                                                initialSelected={condition.spanName || ""}
                                                                onChangeSelected={(selected) => {
                                                                    updateTraceCondition(index, selected as string)
                                                                }}
                                                            />
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeTraceCondition(index)}
                                                            className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>

                                                    {spanUdAttrs.length > 0 && (
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-3">
                                                                <p className="text-sm">User-defined Attributes</p>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => addTraceAttribute(index)}
                                                                    disabled={!canAddMoreUdAttrs || !spanUdAttrs.length}
                                                                    className="text-xs"
                                                                >
                                                                    + Add attribute
                                                                </Button>
                                                            </div>

                                                            {condition.udAttrs && condition.udAttrs.map((udAttr, udAttrIndex) => {
                                                                const operatorTypes = getOperatorsForType(operatorTypesMapping, udAttr.type)
                                                                const availableUdAttrKeys = spanUdAttrs.map(a => a.key);

                                                                return (
                                                                    <SamplingAttributeRow
                                                                        key={`trace-udAttrs-${index}-${udAttrIndex}`}
                                                                        attr={udAttr}
                                                                        attrIndex={udAttrIndex}
                                                                        conditionIndex={index}
                                                                        attributeType="udAttrs"
                                                                        availableAttrKeys={availableUdAttrKeys}
                                                                        operatorTypes={operatorTypes}
                                                                        onUpdateAttribute={updateTraceAttribute}
                                                                        onRemoveAttribute={removeTraceAttribute}
                                                                    />
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {index < traceConditionsState.conditions.length - 1 && (
                                                    <div className="flex justify-start">
                                                        <SamplingLogicalOperatorSelector
                                                            value={traceConditionsState.operators[index] || 'AND'}
                                                            onChange={(operator) => updateTraceOperator(index, operator)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="py-2" />

                    {/* Session conditions */}
                    <div className="w-full">
                        <div className="flex justify-start items-center gap-4">
                            <div className="flex items-center gap-2">
                                <p className="font-display text-xl max-w-6xl">Session conditions</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={addSessionCondition}
                                disabled={sessionConditionsState.conditions.length >= MAX_CONDITIONS}
                            >
                                + Add condition
                            </Button>
                        </div>

                        {sessionConditionsState.conditions.length > 0 && (
                            <div className="pt-4">
                                {sessionConditionsState.conditions.map((condition, index) => (
                                    <div key={index}>
                                        <div className="bg-gray-50 p-3 space-y-6 rounded-lg border">
                                            <div className="flex justify-between items-center">
                                                <div className="flex-1">
                                                    {sessionAttrs.length > 0 && condition.attrs && (
                                                        <div className="space-y-3">
                                                            {condition.attrs.map((attr, attrIndex) => {
                                                                const operatorTypes = getOperatorsForType(operatorTypesMapping, attr.type)
                                                                const availableSessionAttrKeys = sessionAttrs.map(a => a.key);

                                                                return (
                                                                    <SamplingAttributeRow
                                                                        key={`session-attrs-${index}-${attrIndex}`}
                                                                        attr={attr}
                                                                        attrIndex={attrIndex}
                                                                        conditionIndex={index}
                                                                        attributeType="attrs"
                                                                        availableAttrKeys={availableSessionAttrKeys}
                                                                        operatorTypes={operatorTypes}
                                                                        onUpdateAttribute={updateSessionAttribute}
                                                                        showDeleteButton={false}
                                                                    />
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeSessionCondition(index)}
                                                    className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>

                                        {index < sessionConditionsState.conditions.length - 1 && (
                                            <div className="flex justify-start">
                                                <SamplingLogicalOperatorSelector
                                                    value={sessionConditionsState.operators[index] || 'AND'}
                                                    onChange={(operator) => updateSessionOperator(index, operator)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}