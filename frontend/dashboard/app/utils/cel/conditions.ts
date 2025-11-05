// Shared attribute field type
export interface AttributeField {
    id: string
    key: string
    type: string
    value: string | boolean | number
    hint?: string
    operator?: string
    hasError?: boolean
    errorMessage?: string
}

export interface EventCondition {
    id: string
    type: string
    attrs: AttributeField[]
    ud_attrs: AttributeField[]
    session_attrs: AttributeField[]
}

export interface AttributeCondition {
    id: string
    attrs: AttributeField[]
}

export interface TraceCondition {
    id: string
    spanName: string
    operator: string
    ud_attrs: AttributeField[]
    session_attrs: AttributeField[]
}

export interface Conditions<T> {
    conditions: T[]
    operators: ('AND' | 'OR')[]
}

export type EventConditions = Conditions<EventCondition>
export type SessionConditions = Conditions<AttributeCondition>
export type TraceConditions = Conditions<TraceCondition>