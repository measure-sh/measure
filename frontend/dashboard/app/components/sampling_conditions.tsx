"use client"

import { Button } from '@/app/components/button';
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select';
import SamplingAttributeRow from '@/app/components/sampling_attribute_row';
import SamplingLogicalOperatorSelector from '@/app/components/sampling_logical_operator_selector';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { emptySamplingRulesConfigResponse } from '../api/api_calls';

const MAX_CONDITIONS = 5;
const MAX_ATTRIBUTES_PER_CONDITION = 5;

export interface EventCondition {
    type: string | null
    attrs: Array<{
        key: string,
        type: string,
        value: string | boolean | number
    }> | null,
    udAttrs: Array<{
        key: string,
        type: string,
        value: string | boolean | number
    }> | null
}

export interface SessionCondition {
    attrs: Array<{
        key: string,
        type: string,
        value: string | boolean | number
    }> | null
}

interface EventConditionsState {
    conditions: EventCondition[]
    operators: ('AND' | 'OR')[]
}

interface SessionConditionsState {
    conditions: SessionCondition[]
    operators: ('AND' | 'OR')[]
}

interface SamplingRateState {
    value: string | number;
}

interface SamplingConditionsProps {
    samplingRulesConfig: typeof emptySamplingRulesConfigResponse
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

// Helper function to check if conditions are empty
const areConditionsEmpty = (eventConditionsState: EventConditionsState, sessionConditionsState: SessionConditionsState): boolean => {
    // Check event conditions - consider valid if there's a type selected OR attributes
    const hasValidEventConditions = eventConditionsState.conditions.some(condition => {
        return condition.type !== null || 
            (condition.attrs && condition.attrs.length > 0) ||
            (condition.udAttrs && condition.udAttrs.length > 0);
    });

    // Check session conditions
    const hasValidSessionConditions = sessionConditionsState.conditions.some(condition => {
        return condition.attrs && condition.attrs.length > 0;
    });

    return !hasValidEventConditions && !hasValidSessionConditions;
};

export default function SamplingConditions({ samplingRulesConfig }: SamplingConditionsProps) {
    const [eventConditionsState, setEventConditionsState] = useState<EventConditionsState>({
        conditions: [createEmptyEventCondition()],
        operators: []
    })

    const [sessionConditionsState, setSessionConditionsState] = useState<SessionConditionsState>({
        conditions: [],
        operators: []
    })

    const [samplingRateState, setSamplingRateState] = useState<SamplingRateState>({
        value: 100
    });

    // Event condition handlers
    const addEventCondition = () => {
        if (eventConditionsState.conditions.length < MAX_CONDITIONS) {
            const newCondition = createEmptyEventCondition()
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

        const availableAttrs = getAvailableAttributes(samplingRulesConfig, condition.type, attributeType)
        if (!canAddMoreAttributes(condition, availableAttrs, attributeType)) return

        const firstAttr = availableAttrs[0];
        if (!firstAttr) return;

        const newAttr = {
            key: firstAttr.key,
            type: firstAttr.type,
            value: firstAttr.type === 'boolean' ? false : ''
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
        field: 'key' | 'type' | 'value',
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
                        const availableAttrs = getAvailableAttributes(samplingRulesConfig, condition.type, attributeType)
                        const selectedAttr = availableAttrs.find(a => a.key === value)
                        if (selectedAttr) {
                            updatedAttr.type = selectedAttr.type
                            updatedAttr.value = selectedAttr.type === 'boolean' ? false : ''
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
            const sessionAttrs = getSessionAttributes(samplingRulesConfig)
            const newCondition = createEmptySessionCondition()

            if (sessionAttrs.length > 0) {
                const firstAttr = sessionAttrs[0]
                newCondition.attrs = [{
                    key: firstAttr.key,
                    type: firstAttr.type,
                    value: firstAttr.type === 'bool' ? false : ''
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
        field: 'key' | 'type' | 'value',
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
                        const sessionAttrs = getSessionAttributes(samplingRulesConfig)
                        const selectedAttr = sessionAttrs.find(a => a.key === value)
                        if (selectedAttr) {
                            updatedAttr.type = selectedAttr.type
                            updatedAttr.value = selectedAttr.type === 'bool' ? false : ''
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

    const removeSessionAttribute = (conditionIndex: number, attrIndex: number) => {
        // For session conditions, removing the attribute removes the entire condition
        removeSessionCondition(conditionIndex);
    }

    const eventTypes = getEventTypesFromResponse(samplingRulesConfig);
    const operatorTypesMapping = getOperatorTypesMapping(samplingRulesConfig);
    const sessionAttrs = getSessionAttributes(samplingRulesConfig);

    // Check if conditions are empty for preview
    const conditionsAreEmpty = areConditionsEmpty(eventConditionsState, sessionConditionsState);

    return (
        <div className="w-full space-y-6">
            {/* Event conditions */}
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
                            const availableAttrs = condition.type ? getEventAttributes(samplingRulesConfig, condition.type) : []
                            const canAddMoreRegularAttrs = canAddMoreAttributes(condition, availableAttrs, 'attrs')
                            const globalUserDefinedAttrs = getUserDefinedAttributes(samplingRulesConfig)
                            const canAddMoreUdAttrs = canAddMoreAttributes(condition, globalUserDefinedAttrs, 'udAttrs')

                            return (
                                <div key={index}>
                                    <div className="bg-gray-50 p-3 space-y-6">
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

                                        {availableAttrs.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <p className="text-sm">Attributes</p>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => addAttribute(index, 'attrs')}
                                                        disabled={!canAddMoreRegularAttrs}
                                                        className="text-xs"
                                                    >
                                                        + Add attribute
                                                    </Button>
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
                                            </div>
                                        )}

                                        {condition.type && doesEventSupportUdAttrs(samplingRulesConfig, condition.type) && globalUserDefinedAttrs.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <p className="text-sm">User-defined attributes</p>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => addAttribute(index, 'udAttrs')}
                                                        disabled={!canAddMoreUdAttrs}
                                                        className="text-xs"
                                                    >
                                                        + Add attribute
                                                    </Button>
                                                </div>

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
                                        <div className="py-3">
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

            <div className="py-2" />

            {/* Session conditions - Modified UI */}
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
                                <div className="bg-gray-50 p-3 space-y-6">
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
                                                        onRemoveAttribute={removeSessionAttribute}
                                                        showDeleteButton={false}
                                                    />
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {index < sessionConditionsState.conditions.length - 1 && (
                                    <div className="py-3">
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

            <div className="py-2" />

            {/* Sampling rate */}
            <div className="w-full">
                <div className="flex justify-between">
                    <div className="flex items-center gap-2">
                        <p className="font-display text-xl max-w-6xl">Sampling rate</p>
                    </div>
                </div>

                <div className="pt-4">
                    <input
                        type="number"
                        placeholder="0-100%"
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
                        className="w-24 my-2 border border-black rounded-md outline-hidden text-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-2 font-body placeholder:text-neutral-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    /> %
                </div>
            </div>

            <div className="py-1" />

            {/* Preview */}
            <div className="w-full">
                <div className="flex justify-between">
                    <div className="flex items-center gap-2">
                         <p className="font-display text-gray-500">Preview</p>
                    </div>
                </div>

                <div className="pt-4">
                    <div className="whitespace-pre-wrap leading-5.5 bg-gray-50 p-4 text-xs font-mono">
                        {conditionsAreEmpty ? (
                            <div className="text-gray-500 font-sans text-sm">
                                Please add event or session conditions to see the preview.
                            </div>
                        ) : (
                            <pre>
                                {JSON.stringify({
                                    event_conditions: eventConditionsState,
                                    session_conditions: sessionConditionsState,
                                    sampling_rate: samplingRateState.value
                                }, null, 2)}
                            </pre>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}