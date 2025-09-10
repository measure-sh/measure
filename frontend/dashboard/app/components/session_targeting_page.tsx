"use client"

import { createSessionTargetingRule, CreateSessionTargetingRuleApiStatus, emptySamplingRuleResponse, emptySessionTargetingConfigResponse, emptySessionTargetingRulesResponse, fetchSessionTargetingConfigFromServer, fetchSessionTargetingRuleFromServer, SessionTargetingConfigApiStatus, SessionTargetingRuleApiStatus, updateSessionTargetingRule, UpdateSessionTargetingRuleApiStatus } from '@/app/api/api_calls';
import LoadingSpinner from '@/app/components/loading_spinner';
import SamplingConditionSection from '@/app/components/sampling_condition_section';
import SamplingEventCondition from '@/app/components/sampling_event_condition';
import SamplingLogicalOperatorSelector from '@/app/components/sampling_logical_operator_selector';
import SaveSessionTargetingRule from '@/app/components/save_session_targeting_rule';
import SamplingSessionCondition from '@/app/components/session_condition';
import { EventCondition, EventConditions, SessionCondition, SessionConditions } from '@/app/utils/cel-types';
import { generateEventRuleCelArray, generateSessionRuleCelArray, getDefaultOperatorForType } from '@/app/utils/cel-utils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export type SessionTargetingRulesConfig = typeof emptySessionTargetingRulesResponse;
const MAX_CONDITIONS = 10;
const MAX_ATTRIBUTES_PER_CONDITION = 10;

interface SamplingRateState {
    value: string | number;
}

interface PageState {
    sessionTargetingConfigApiStatus: SessionTargetingConfigApiStatus
    sessionTargetingConfig: typeof emptySessionTargetingConfigResponse
    samplingRuleApiStatus: SessionTargetingRuleApiStatus
    samplingRule: typeof emptySamplingRuleResponse
}

interface SamplingRulePageProps {
    params: {
        teamId: string;
        appId: string;
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
    SessionTargetingConfig: typeof emptySessionTargetingConfigResponse,
    eventType: string | null,
    attributeType: AttributeType
) => {
    if (attributeType === 'attrs' && eventType) {
        return getEventAttributes(SessionTargetingConfig, eventType);
    } else if (attributeType === 'udAttrs' && eventType) {
        if (doesEventSupportUdAttrs(SessionTargetingConfig, eventType)) {
            return getUserDefinedAttributes(SessionTargetingConfig);
        }
        return [];
    }
    return [];
};

// Loading state helper functions
const isPageLoading = (pageState: PageState, isEditMode: boolean): boolean => {
    return pageState.sessionTargetingConfigApiStatus === SessionTargetingConfigApiStatus.Loading ||
        (isEditMode && pageState.samplingRuleApiStatus === SessionTargetingRuleApiStatus.Loading);
};

const hasPageError = (pageState: PageState, isEditMode: boolean): boolean => {
    return pageState.sessionTargetingConfigApiStatus === SessionTargetingConfigApiStatus.Error ||
        (isEditMode && pageState.samplingRuleApiStatus === SessionTargetingRuleApiStatus.Error);
};

const isPageReady = (pageState: PageState, isEditMode: boolean): boolean => {
    return pageState.sessionTargetingConfigApiStatus === SessionTargetingConfigApiStatus.Success &&
        (!isEditMode || pageState.samplingRuleApiStatus === SessionTargetingRuleApiStatus.Success);
};

// Helper function to check if conditions are empty
const areConditionsEmpty = (
    eventConditionsState: EventConditions,
    sessionConditionsState: SessionConditions,
    samplingRuleName: string | null,
): boolean => {
    const hasValidEventConditions = eventConditionsState.conditions.some(condition => {
        return condition.type !== null ||
            (condition.attrs && condition.attrs.length > 0) ||
            (condition.udAttrs && condition.udAttrs.length > 0);
    });

    const hasValidSessionConditions = sessionConditionsState.conditions.some(condition => {
        return condition.attrs && condition.attrs.length > 0;
    });

    const hasValidSamplingRuleName = samplingRuleName !== null && samplingRuleName.trim().length > 0;

    return !hasValidEventConditions && !hasValidSessionConditions && !hasValidSamplingRuleName;
};

export default function SessionTargetingPage({ params, isEditMode }: SamplingRulePageProps) {
    const router = useRouter()
    const nameFromParams = isEditMode && params.ruleName ? decodeURIComponent(params.ruleName) : null

    const initialState: PageState = {
        sessionTargetingConfigApiStatus: SessionTargetingConfigApiStatus.Loading,
        sessionTargetingConfig: emptySessionTargetingConfigResponse,
        samplingRuleApiStatus: SessionTargetingRuleApiStatus.Loading,
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
    const [samplingRateState, setSamplingRateState] = useState<SamplingRateState>({
        value: 100
    });
    const [SessionTargetingtatus, setSessionTargetingtatus] = useState<'enabled' | 'disabled'>('enabled'); // TODO: handle status change

    // Collapsible sections state
    const [eventSectionCollapsed, setEventSectionCollapsed] = useState(false);
    const [sessionSectionCollapsed, setSessionSectionCollapsed] = useState(false);

    const updatePageState = (newState: Partial<PageState>) => {
        setPageState(prevState => {
            const updatedState = { ...prevState, ...newState }
            return updatedState
        })
    }

    const getSessionTargetingConfig = async () => {
        updatePageState({ sessionTargetingConfigApiStatus: SessionTargetingConfigApiStatus.Loading })
        const result = await fetchSessionTargetingConfigFromServer(params.teamId, params.appId)

        switch (result.status) {
            case SessionTargetingConfigApiStatus.Error:
                updatePageState({ sessionTargetingConfigApiStatus: SessionTargetingConfigApiStatus.Error })
                break
            case SessionTargetingConfigApiStatus.Success:
                updatePageState({
                    sessionTargetingConfigApiStatus: SessionTargetingConfigApiStatus.Success,
                    sessionTargetingConfig: result.data
                })
                break
        }
    }

    const getSamplingRule = async () => {
        if (!isEditMode) {
            // For create mode, just mark as success
            updatePageState({ samplingRuleApiStatus: SessionTargetingRuleApiStatus.Success })
            return
        }

        if (!params.ruleId) {
            updatePageState({ samplingRuleApiStatus: SessionTargetingRuleApiStatus.Error })
            return
        }

        updatePageState({ samplingRuleApiStatus: SessionTargetingRuleApiStatus.Loading })
        const result = await fetchSessionTargetingRuleFromServer(params.teamId, params.appId, params.ruleId)

        switch (result.status) {
            case SessionTargetingRuleApiStatus.Error:
                updatePageState({ samplingRuleApiStatus: SessionTargetingRuleApiStatus.Error })
                break
            case SessionTargetingRuleApiStatus.Success:
                updatePageState({
                    samplingRuleApiStatus: SessionTargetingRuleApiStatus.Success,
                    samplingRule: result.data
                })
                break
        }
    }

    useEffect(() => {
        getSessionTargetingConfig()
    }, [])

    useEffect(() => {
        if (isEditMode && pageState.sessionTargetingConfigApiStatus === SessionTargetingConfigApiStatus.Success) {
            getSamplingRule()
        }
    }, [isEditMode, pageState.sessionTargetingConfigApiStatus])

    // Effect to populate title and sampling rate when rule data is loaded
    useEffect(() => {
        if (isEditMode && pageState.samplingRuleApiStatus === SessionTargetingRuleApiStatus.Success && pageState.samplingRule.results) {
            const ruleData = pageState.samplingRule.results

            if (ruleData.name) {
                setSamplingRuleName(ruleData.name)
            }
            if (typeof ruleData.sampling_rate === 'number') {
                setSamplingRateState({ value: ruleData.sampling_rate })
            }
            if (typeof ruleData.status === 'number') {
                setSessionTargetingtatus(ruleData.status === 1 ? 'enabled' : 'disabled')
            }

            // Parse CEL rule into conditions
        }
    }, [isEditMode, pageState.samplingRuleApiStatus, pageState.samplingRule])

    // Effect to set the first event type when eventTypes are available
    useEffect(() => {
        const eventTypes = getEventTypesFromResponse(pageState.sessionTargetingConfig);

        if (eventTypes.length > 0) {
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
    }, [pageState.sessionTargetingConfig]);


    const handleTitleChange = (title: string) => {
        setSamplingRuleName(title);
    };

    // Event condition handlers
    const addEventCondition = () => {
        if (eventConditionsState.conditions.length < MAX_CONDITIONS) {
            const eventTypes = getEventTypesFromResponse(pageState.sessionTargetingConfig);
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

        const availableAttrs = getAvailableAttributes(pageState.sessionTargetingConfig, condition.type, attributeType)
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
                        const availableAttrs = getAvailableAttributes(pageState.sessionTargetingConfig, condition.type, attributeType)
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
            const sessionAttrs = getSessionAttributes(pageState.sessionTargetingConfig)
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
                        const sessionAttrs = getSessionAttributes(pageState.sessionTargetingConfig)
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

    const handleCreateSamplingRule = async () => {
        // Generate CEL expressions as arrays
        let eventRuleCel = null;
        let sessionRuleCel = null;
        let ruleCel = null;

        sessionRuleCel = generateSessionRuleCelArray(sessionConditionsState);
        eventRuleCel = generateEventRuleCelArray(eventConditionsState);
        ruleCel = `${eventRuleCel} && ${sessionRuleCel}`;


        // Prepare rule data
        const ruleData = {
            name: samplingRuleName || '', // TODO: add validation
            status: SessionTargetingtatus === 'enabled' ? 1 : 0,
            sampling_rate: Number(samplingRateState.value),
            rule: ruleCel,
        };

        try {
            const result = await createSessionTargetingRule(params.teamId, params.appId, ruleData);

            if (result.status === CreateSessionTargetingRuleApiStatus.Success) {
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
        // Generate CEL expressions as arrays
        let eventRuleCel = null;
        let sessionRuleCel = null;
        let ruleCel = null;


        sessionRuleCel = generateSessionRuleCelArray(sessionConditionsState);
        eventRuleCel = generateEventRuleCelArray(eventConditionsState);
        ruleCel = `${eventRuleCel} && ${sessionRuleCel}`;

        // Prepare rule data
        const ruleData = {
            id: params.ruleId || '', // TODO: add validation
            name: samplingRuleName || '', // TODO: add validation
            status: SessionTargetingtatus === 'enabled' ? 1 : 0,
            sampling_rate: Number(samplingRateState.value) / 100, // Convert percentage to decimal
            rule: ruleCel,
        };

        try {
            const result = await updateSessionTargetingRule(params.teamId, params.appId, ruleData.id, ruleData);

            if (result.status === UpdateSessionTargetingRuleApiStatus.Success) {
                // TODO: Navigate to sampling rules list page
                router.push(`/teams/${params.teamId}/apps/${params.appId}/sampling-rules`);
            } else {
                // TODO: Show error
                console.error('Failed to update sampling rule:', result.error);
            }
        } catch (error) {
            console.error('Error updating sampling rule:', error);
        }
    }

    const eventTypes = getEventTypesFromResponse(pageState.sessionTargetingConfig);
    const operatorTypesMapping = getOperatorTypesMapping(pageState.sessionTargetingConfig);
    const sessionAttrs = getSessionAttributes(pageState.sessionTargetingConfig);
    const conditionsAreEmpty = areConditionsEmpty(eventConditionsState, sessionConditionsState, samplingRuleName);

    return (
        <div className="flex flex-col selection:bg-yellow-200/75 items-start">
            <div className="flex flex-row items-start gap-2 justify-between w-full">
                <div className="flex flex-col">
                    <h1 className="font-display text-4xl">Session Targeting Rule</h1>
                    {isPageReady(pageState, isEditMode) && (
                        <>
                            <div className="py-2" />
                            <span className={`w-fit px-2 py-1 rounded-full border text-sm font-body ${SessionTargetingtatus === 'enabled' ? 'border-green-600 text-green-600 bg-green-50' : 'border-indigo-600 text-indigo-600 bg-indigo-50'}`}>
                                {SessionTargetingtatus === 'enabled' ? 'Enabled' : 'Disabled'}
                            </span>
                            <div className="py-4" />
                            <div className="grid gap-y-4 items-center max-w-2xl" style={{ gridTemplateColumns: '120px 1fr' }}>
                                <p className="text-sm">Rule name</p>
                                <input
                                    type="text"
                                    placeholder="Enter rule name"
                                    value={samplingRuleName || ""}
                                    maxLength={64}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    className="w-96 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400"
                                />
                                <p className="text-sm">Sampling rate</p>
                                <div className="flex items-center">
                                    <input
                                        type="number"
                                        placeholder="Value between 0-1, 0.2 for 20%"
                                        value={samplingRateState.value}
                                        min={0}
                                        max={1}
                                        step="0.1" // Add this line
                                        onChange={(e) => {
                                            setSamplingRateState({ value: e.target.value });
                                        }}
                                        onBlur={(e) => {
                                            const val = Number(e.target.value);
                                            setSamplingRateState({
                                                value: Math.max(0, Math.min(1, isNaN(val) ? 0 : val))
                                            });
                                        }}
                                        className="w-96 border border-black rounded-md outline-hidden text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-4 font-body placeholder:text-neutral-400"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <SaveSessionTargetingRule
                    isEditMode={isEditMode}
                    isReady={isPageReady(pageState, isEditMode)}
                    isDisabled={conditionsAreEmpty}
                    onPublish={handleCreateSamplingRule}
                    onUpdate={handleUpdateSamplingRule}
                />
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

            <div className="py-4" />

            {/* Main sampling conditions UI */}
            {isPageReady(pageState, isEditMode) && (
                <div className="w-full space-y-4">
                    <div className="w-full space-y-4">
                        {/* Event conditions */}
                        {(
                            <SamplingConditionSection
                                title="Event Conditions"
                                conditionCount={eventConditionsState.conditions.length}
                                maxConditions={MAX_CONDITIONS}
                                isCollapsed={eventSectionCollapsed}
                                onToggleCollapse={() => setEventSectionCollapsed(!eventSectionCollapsed)}
                                onAddCondition={addEventCondition}
                            >
                                {eventConditionsState.conditions.length > 0 && (
                                    <div className="pt-1">
                                        {eventConditionsState.conditions.map((condition, index) => {
                                            const availableAttrs = condition.type ? getEventAttributes(pageState.sessionTargetingConfig, condition.type) : []
                                            const canAddMoreRegularAttrs = canAddMoreAttributes(condition, availableAttrs, 'attrs')
                                            const globalUserDefinedAttrs = getUserDefinedAttributes(pageState.sessionTargetingConfig)
                                            const canAddMoreUdAttrs = canAddMoreAttributes(condition, globalUserDefinedAttrs, 'udAttrs')

                                            return (
                                                <div key={index}>
                                                    <SamplingEventCondition
                                                        condition={condition}
                                                        index={index}
                                                        eventTypes={eventTypes}
                                                        availableAttrs={availableAttrs}
                                                        globalUserDefinedAttrs={globalUserDefinedAttrs}
                                                        operatorTypesMapping={operatorTypesMapping}
                                                        canAddMoreRegularAttrs={canAddMoreRegularAttrs}
                                                        canAddMoreUdAttrs={canAddMoreUdAttrs}
                                                        doesEventSupportUdAttrs={doesEventSupportUdAttrs}
                                                        pageConfig={pageState.sessionTargetingConfig}
                                                        onUpdateCondition={updateEventCondition}
                                                        onRemoveCondition={removeEventCondition}
                                                        onAddAttribute={addAttribute}
                                                        onUpdateAttribute={updateAttribute}
                                                        onRemoveAttribute={removeAttribute}
                                                        getOperatorsForType={getOperatorsForType}
                                                    />

                                                    {index < eventConditionsState.conditions.length - 1 && (
                                                        <div className="flex justify-center">
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
                            </SamplingConditionSection>
                        )}

                        {/* Session conditions */}
                        <SamplingConditionSection
                            title="Session Conditions"
                            conditionCount={sessionConditionsState.conditions.length}
                            maxConditions={MAX_CONDITIONS}
                            isCollapsed={sessionSectionCollapsed}
                            onToggleCollapse={() => setSessionSectionCollapsed(!sessionSectionCollapsed)}
                            onAddCondition={addSessionCondition}
                        >
                            {sessionConditionsState.conditions.length > 0 && (
                                <div className="pt-1">
                                    {sessionConditionsState.conditions.map((condition, index) => (
                                        <div key={index}>
                                            <SamplingSessionCondition
                                                condition={condition}
                                                index={index}
                                                sessionAttrs={sessionAttrs}
                                                operatorTypesMapping={operatorTypesMapping}
                                                onRemoveCondition={removeSessionCondition}
                                                onUpdateAttribute={updateSessionAttribute}
                                                getOperatorsForType={getOperatorsForType}
                                            />

                                            {index < sessionConditionsState.conditions.length - 1 && (
                                                <div className="flex justify-center">
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
                        </SamplingConditionSection>
                    </div>
                </div>
            )}
        </div>
    );
}