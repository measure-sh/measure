// Shared attribute field type
export interface BaseAttributeField {
    id: string
    key: string
    type: string
    value: string | boolean | number
    operator: string
    hint?: string
}

// For UI only - extends base with source
export interface AttributeField extends BaseAttributeField {
    source: 'fixed' | 'session' | 'ud'
}
export interface EventCondition {
    id: string
    type: string
    attrs: BaseAttributeField[]
    ud_attrs: BaseAttributeField[]
    session_attrs: BaseAttributeField[]
}

export interface TraceCondition {
    id: string
    spanName: string
    operator: string
    ud_attrs: BaseAttributeField[]
    session_attrs: BaseAttributeField[]
}

export interface Conditions<T> {
    conditions: T[]
    operators: ('AND' | 'OR')[]
}

export type EventConditions = Conditions<EventCondition>
export type TraceConditions = Conditions<TraceCondition>