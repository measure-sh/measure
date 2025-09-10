export interface EventCondition {
    id: string
    type: string | null
    attrs: Array<{
        id: string,
        key: string,
        type: string,
        value: string | boolean | number,
        operator?: string
    }> | null,
    ud_attrs: Array<{
        id: string,
        key: string,
        type: string,
        value: string | boolean | number,
        operator?: string
    }> | null
}

export interface SessionCondition {
    id: string
    attrs: Array<{
        id: string,
        key: string,
        type: string,
        value: string | boolean | number,
        operator?: string
    }> | null
}

export interface TraceCondition {
    spanName: string | null
    ud_attrs: Array<{
        id: string,
        key: string,
        type: string,
        value: string | boolean | number,
        operator?: string
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