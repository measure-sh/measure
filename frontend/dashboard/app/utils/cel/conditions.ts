export interface EventCondition {
    id: string
    type: string
    attrs: Array<{
        id: string,
        key: string,
        type: string,
        value: string | boolean | number,
        hint?: string,
        operator?: string,
        hasError?: boolean,
        errorMessage?: string
    }>,
    ud_attrs: Array<{
        id: string,
        key: string,
        type: string,
        value: string | boolean | number,
        hint?: string,
        operator?: string,
        hasError?: boolean,
        errorMessage?: string
    }>
}

export interface SessionCondition {
    id: string
    attrs: Array<{
        id: string,
        key: string,
        type: string,
        value: string | boolean | number,
        hint?: string,
        operator?: string,
        hasError?: boolean,
        errorMessage?: string
    }>
}

export interface TraceCondition {
    id: string
    spanName: string
    operator: string
    ud_attrs: Array<{
        id: string,
        key: string,
        type: string,
        value: string | boolean | number,
        operator?: string,
        hasError?: boolean,
        errorMessage?: string
    }>
}

export interface EventConditions {
    conditions: EventCondition[]
    operators: ('AND' | 'OR')[]
}

export interface SessionConditions {
    conditions: SessionCondition[]
    operators: ('AND' | 'OR')[]
}

export interface TraceConditions {
    conditions: TraceCondition[]
    operators: ('AND' | 'OR')[]
}