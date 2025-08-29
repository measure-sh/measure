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

export interface TraceCondition {
    spanName: string | null
    udAttrs: Array<{
        key: string,
        type: string,
        value: string | boolean | number
    }> | null
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