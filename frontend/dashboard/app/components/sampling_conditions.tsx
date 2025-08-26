"use client"

import { Button } from '@/app/components/button';
import DropdownSelect, { DropdownSelectType } from '@/app/components/dropdown_select';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { emptySamplingRulesConfigResponse } from '../api/api_calls';
import SamplingLogicalOperatorSelector from '@/app/components/sampling_logical_operator_selector';
import SamplingAttributeRow from '@/app/components/sampling_attribute_row';

const MAX_CONDITIONS = 5;
const MAX_ATTRIBUTES_PER_CONDITION = 5;

export interface EventCondition {
    eventType: string | null
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

interface SamplingConditionsProps {
    samplingRulesConfig: typeof emptySamplingRulesConfigResponse
}

type AttributeType = 'attrs' | 'udAttrs';

const createEmptyEventCondition = (): EventCondition => ({
    eventType: null,
    attrs: null,
    udAttrs: null
})

const createEmptySessionCondition = (): SessionCondition => ({
    attrs: null
})

export const getEventTypesFromResponse = (response: typeof emptySamplingRulesConfigResponse) => {
    return response.result?.events?.map(event => event.type) || [];
};

// Helper function to get attributes for a specific event type
const getEventAttributes = (response: typeof emptySamplingRulesConfigResponse, eventType: string) => {
    const event = response.result?.events?.find(e => e.type === eventType);
    return event?.attrs || [];
};

// Helper function to check if an event type supports user-defined attributes
const doesEventSupportUdAttrs = (response: typeof emptySamplingRulesConfigResponse, eventType: string): boolean => {
    const event = response.result?.events?.find(e => e.type === eventType);
    return event?.ud_attrs === true;
};

// Helper function to get user-defined attributes from config
const getUserDefinedAttributes = (response: typeof emptySamplingRulesConfigResponse) => {
    return response.result?.event_ud_attrs?.key_types || [];
};

// Helper function to get operator types mapping
const getOperatorTypesMapping = (response: typeof emptySamplingRulesConfigResponse) => {
    return response.result?.operator_types || {};
};

// Helper function to get operators for a specific type with proper typing
const getOperatorsForType = (operatorMapping: Record<string, string[]>, type: string): string[] => {
    return operatorMapping[type] || [];
};

// Updated helper function to only check max count (removed duplicate key check)
const canAddMoreAttributes = (
    condition: EventCondition,
    availableAttrs: any[],
    attributeType: AttributeType
): boolean => {
    const currentAttrs = condition[attributeType];
    const currentCount = currentAttrs ? currentAttrs.length : 0;

    // Check if we've reached the maximum count
    if (currentCount >= MAX_ATTRIBUTES_PER_CONDITION) {
        return false;
    }

    // Check if there are any available attributes
    return availableAttrs.length > 0;
};

// Generic helper to get available attributes based on type
const getAvailableAttributes = (
    samplingRulesConfig: typeof emptySamplingRulesConfigResponse,
    eventType: string | null,
    attributeType: AttributeType
) => {
    if (attributeType === 'attrs' && eventType) {
        return getEventAttributes(samplingRulesConfig, eventType);
    } else if (attributeType === 'udAttrs' && eventType) {
        // Only return user-defined attributes if the event type supports them
        if (doesEventSupportUdAttrs(samplingRulesConfig, eventType)) {
            return getUserDefinedAttributes(samplingRulesConfig);
        }
        return [];
    }
    return [];
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

    // Event condition handlers
    const addEventCondition = () => {
        if (eventConditionsState.conditions.length < MAX_CONDITIONS) {
            console.log("Add event condition")
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

        // Remove the operator after this condition, or before if it's the last condition
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

    const updateEventCondition = (conditionIndex: number, eventType: string) => {
        if (conditionIndex < 0 || conditionIndex >= eventConditionsState.conditions.length) return

        const updatedConditions = eventConditionsState.conditions.map((condition, index) =>
            index === conditionIndex
                ? { ...condition, eventType, attrs: null, udAttrs: null } // Reset both attrs when event type changes
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

    // Generic attribute handlers
    const addAttribute = (conditionIndex: number, attributeType: AttributeType) => {
        const condition = eventConditionsState.conditions[conditionIndex]
        if (!condition || !condition.eventType) return

        const availableAttrs = getAvailableAttributes(samplingRulesConfig, condition.eventType, attributeType)
        if (!canAddMoreAttributes(condition, availableAttrs, attributeType)) return

        // Always use the first available attribute (no duplicate checking)
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

                    // Reset value when key changes to get the new type
                    if (field === 'key') {
                        const availableAttrs = getAvailableAttributes(samplingRulesConfig, condition.eventType, attributeType)
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
            console.log("Add session condition")
            const newCondition = createEmptySessionCondition()
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

        // Remove the operator after this condition, or before if it's the last condition
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

    const eventTypes = getEventTypesFromResponse(samplingRulesConfig);
    const operatorTypesMapping = getOperatorTypesMapping(samplingRulesConfig);

    return (
        <div className="w-full space-y-6">
            {/* Event conditions */}
            <div className="w-full">
                <div className="flex justify-between">
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
                            const availableAttrs = condition.eventType ? getEventAttributes(samplingRulesConfig, condition.eventType) : []
                            const canAddMoreRegularAttrs = canAddMoreAttributes(condition, availableAttrs, 'attrs')
                            const globalUserDefinedAttrs = getUserDefinedAttributes(samplingRulesConfig)
                            const canAddMoreUdAttrs = canAddMoreAttributes(condition, globalUserDefinedAttrs, 'udAttrs')

                            return (
                                <div key={index}>
                                    {/* Condition box */}
                                    <div className="border border-gray-200 p-3 relative space-y-6">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeEventCondition(index)}
                                            className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>

                                        {/* Event Type Selection */}
                                        <div className="flex flex-row items-center">
                                            <p className="text-sm">Event Type</p>
                                            <div className="px-3" />
                                            <DropdownSelect
                                                type={DropdownSelectType.SingleString}
                                                title="Select Event Type"
                                                items={eventTypes}
                                                initialSelected={condition.eventType || (eventTypes.length > 0 ? eventTypes[0] : "")}
                                                onChangeSelected={(selected) => {
                                                    console.log(`Selected event type for condition ${index + 1}: `, selected)
                                                    updateEventCondition(index, selected as string)
                                                }}
                                            />
                                        </div>

                                        {/* Event Attributes Section */}
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
                                                        title={
                                                            (condition.attrs?.length || 0) >= MAX_ATTRIBUTES_PER_CONDITION
                                                                ? `Maximum ${MAX_ATTRIBUTES_PER_CONDITION} attributes allowed per condition`
                                                                : undefined
                                                        }
                                                    >
                                                        + Add attribute
                                                    </Button>
                                                </div>

                                                {condition.attrs && condition.attrs.map((attr, attrIndex) => {
                                                    const operatorTypes = getOperatorsForType(operatorTypesMapping, attr.type)
                                                    // Now all attribute keys are available (no filtering for duplicates)
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

                                        {/* User Defined Attributes Section */}
                                        {condition.eventType && doesEventSupportUdAttrs(samplingRulesConfig, condition.eventType) && globalUserDefinedAttrs.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <p className="text-sm">User-defined attributes</p>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => addAttribute(index, 'udAttrs')}
                                                        disabled={!canAddMoreUdAttrs}
                                                        className="text-xs"
                                                        title={
                                                            (condition.udAttrs?.length || 0) >= MAX_ATTRIBUTES_PER_CONDITION
                                                                ? `Maximum ${MAX_ATTRIBUTES_PER_CONDITION} user defined attributes allowed per condition`
                                                                : undefined
                                                        }
                                                    >
                                                        + Add attribute
                                                    </Button>
                                                </div>

                                                {condition.udAttrs && condition.udAttrs.map((udAttr, udAttrIndex) => {
                                                    const operatorTypes = getOperatorsForType(operatorTypesMapping, udAttr.type)
                                                    // Now all user-defined attribute keys are available (no filtering for duplicates)
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

                                    {/* Logical Operator (show only if not the last condition) */}
                                    {index < eventConditionsState.conditions.length - 1 && (
                                        <div className="py-3">
                                            <SamplingLogicalOperatorSelector
                                                value={eventConditionsState.operators[index] || 'AND'}
                                                onChange={(operator) => {
                                                    console.log(`Updated operator ${index}: `, operator)
                                                    updateEventOperator(index, operator)
                                                }}
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

            {/* Session conditions */}
            <div className="w-full">
                <div className="flex justify-between">
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
                    <div className="pt-4 space-y-3">
                        {sessionConditionsState.conditions.map((condition, index) => (
                            <div key={index}>
                                {/* Session Condition Card */}
                                <div className="border border-gray-200 p-3 relative">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeSessionCondition(index)}
                                        className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                    <div className="flex flex-row items-center">
                                        <p className="text-sm">Session condition</p>
                                        {/* Add session condition UI elements here */}
                                    </div>
                                </div>

                                {/* Logical Operator (show only if not the last condition) */}
                                {index < sessionConditionsState.conditions.length - 1 && (
                                    <SamplingLogicalOperatorSelector
                                        value={sessionConditionsState.operators[index] || 'AND'}
                                        onChange={(operator) => {
                                            console.log(`Updated session operator ${index}: `, operator)
                                            updateSessionOperator(index, operator)
                                        }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}