import { 
  EventCondition, 
  SessionCondition, 
  TraceCondition,
  EventConditions,
  SessionConditions,
  TraceConditions
} from './cel-types'

const OPERATOR_TO_CEL = {
  eq: '==',
  neq: '!=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  contains: 'contains',
  startsWith: 'startWith'
} as const

const LOGICAL_OPERATOR_TO_CEL = {
  AND: '&&',
  OR: '||'
} as const

function formatValue(value: string | boolean | number, type: string): string {
  if (type === 'string') {
    return `"${value}"`
  }
  return String(value)
}

function formatEventTypeCondition(eventType: string): string {
  return `event_type == "${eventType}"`
}

function formatEventAttributeCondition(attr: { key: string; type: string; value: string | boolean | number; operator?: string }): string {
  const operator = attr.operator ? OPERATOR_TO_CEL[attr.operator as keyof typeof OPERATOR_TO_CEL] || '==' : '=='
  const value = formatValue(attr.value, attr.type)
  
  if (attr.type === 'string' && (operator === 'contains' || operator === 'startWith')) {
    return `${attr.key}.${operator}(${value})`
  }
  
  return `${attr.key} ${operator} ${value}`
}

function formatUserDefinedAttributeCondition(attr: { key: string; type: string; value: string | boolean | number; operator?: string }): string {
  const operator = attr.operator ? OPERATOR_TO_CEL[attr.operator as keyof typeof OPERATOR_TO_CEL] || '==' : '=='
  const value = formatValue(attr.value, attr.type)
  
  if (attr.type === 'string' && (operator === 'contains' || operator === 'startWith')) {
    return `user_defined_attrs.${attr.key}.${operator}(${value})`
  }
  
  return `user_defined_attrs.${attr.key} ${operator} ${value}`
}

function formatSessionAttributeCondition(attr: { key: string; type: string; value: string | boolean | number; operator?: string }): string {
  const operator = attr.operator ? OPERATOR_TO_CEL[attr.operator as keyof typeof OPERATOR_TO_CEL] || '==' : '=='
  const value = formatValue(attr.value, attr.type)
  
  if (attr.type === 'string' && (operator === 'contains' || operator === 'startWith')) {
    return `attribute.${attr.key}.${operator}(${value})`
  }
  
  return `attribute.${attr.key} ${operator} ${value}`
}

function formatSpanNameCondition(spanName: string): string {
  return `span.name.startWith("${spanName}")`
}

function formatSpanUserDefinedAttributeCondition(attr: { key: string; type: string; value: string | boolean | number; operator?: string }): string {
  const operator = attr.operator ? OPERATOR_TO_CEL[attr.operator as keyof typeof OPERATOR_TO_CEL] || '==' : '=='
  const value = formatValue(attr.value, attr.type)
  
  if (attr.type === 'string' && (operator === 'contains' || operator === 'startWith')) {
    return `span.user_defined_attrs.${attr.key}.${operator}(${value})`
  }
  
  return `span.user_defined_attrs.${attr.key} ${operator} ${value}`
}

function formatEventCondition(condition: EventCondition): string[] {
  const parts: string[] = []
  
  if (condition.type) {
    parts.push(formatEventTypeCondition(condition.type))
  }
  
  if (condition.attrs) {
    condition.attrs.forEach(attr => {
      parts.push(formatEventAttributeCondition(attr))
    })
  }
  
  if (condition.udAttrs) {
    condition.udAttrs.forEach(attr => {
      parts.push(formatUserDefinedAttributeCondition(attr))
    })
  }
  
  return parts
}

function formatSessionCondition(condition: SessionCondition): string[] {
  const parts: string[] = []
  
  if (condition.attrs) {
    condition.attrs.forEach(attr => {
      parts.push(formatSessionAttributeCondition(attr))
    })
  }
  
  return parts
}

function formatTraceCondition(condition: TraceCondition): string[] {
  const parts: string[] = []
  
  if (condition.spanName) {
    parts.push(formatSpanNameCondition(condition.spanName))
  }
  
  if (condition.udAttrs) {
    condition.udAttrs.forEach(attr => {
      parts.push(formatSpanUserDefinedAttributeCondition(attr))
    })
  }
  
  return parts
}

function combineConditionParts(parts: string[]): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return `(${parts[0]})`
  
  return `(${parts.join(' && ')})`
}

function combineConditionsWithOperators(
  conditions: string[],
  operators: ('AND' | 'OR')[]
): string {
  if (conditions.length === 0) return ''
  if (conditions.length === 1) return conditions[0]
  
  let result = conditions[0]
  
  for (let i = 0; i < operators.length && i + 1 < conditions.length; i++) {
    const celOperator = LOGICAL_OPERATOR_TO_CEL[operators[i]]
    result = `${result} ${celOperator} ${conditions[i + 1]}`
  }
  
  return conditions.length > 1 ? `(${result})` : result
}

export function generateEventRuleCel(
  eventConditions: EventConditions,
  sessionConditions: SessionConditions
): string | null {
  const eventConditionStrings: string[] = []
  
  eventConditions.conditions.forEach(condition => {
    const parts = formatEventCondition(condition)
    if (parts.length > 0) {
      eventConditionStrings.push(combineConditionParts(parts))
    }
  })
  
  const sessionConditionStrings: string[] = []
  
  sessionConditions.conditions.forEach(condition => {
    const parts = formatSessionCondition(condition)
    if (parts.length > 0) {
      sessionConditionStrings.push(combineConditionParts(parts))
    }
  })
  
  // Combine event conditions with AND/OR operators
  const eventCelPart = eventConditionStrings.length > 0 
    ? combineConditionsWithOperators(eventConditionStrings, eventConditions.operators)
    : null
  
  // Combine session conditions with AND/OR operators
  const sessionCelPart = sessionConditionStrings.length > 0
    ? combineConditionsWithOperators(sessionConditionStrings, sessionConditions.operators)
    : null
  
  // Combine both parts with AND
  if (eventCelPart && sessionCelPart) {
    return `${eventCelPart} && ${sessionCelPart}`
  } else if (eventCelPart) {
    return eventCelPart
  } else if (sessionCelPart) {
    return sessionCelPart
  }
  
  return null
}

export function generateTraceRuleCel(
  traceConditions: TraceConditions,
  sessionConditions: SessionConditions
): string | null {
  const traceConditionStrings: string[] = []
  
  traceConditions.conditions.forEach(condition => {
    const parts = formatTraceCondition(condition)
    if (parts.length > 0) {
      traceConditionStrings.push(combineConditionParts(parts))
    }
  })
  
  const sessionConditionStrings: string[] = []
  
  sessionConditions.conditions.forEach(condition => {
    const parts = formatSessionCondition(condition)
    if (parts.length > 0) {
      sessionConditionStrings.push(combineConditionParts(parts))
    }
  })
  
  // Combine trace conditions with AND/OR operators
  const traceCelPart = traceConditionStrings.length > 0
    ? combineConditionsWithOperators(traceConditionStrings, traceConditions.operators)
    : null
  
  // Combine session conditions with AND/OR operators
  const sessionCelPart = sessionConditionStrings.length > 0
    ? combineConditionsWithOperators(sessionConditionStrings, sessionConditions.operators)
    : null
  
  // Combine both parts with AND
  if (traceCelPart && sessionCelPart) {
    return `${traceCelPart} && ${sessionCelPart}`
  } else if (traceCelPart) {
    return traceCelPart
  } else if (sessionCelPart) {
    return sessionCelPart
  }
  
  return null
}

export function generateSessionRuleCel(
  sessionConditions: SessionConditions
): string | null {
  const sessionConditionStrings: string[] = []
  
  sessionConditions.conditions.forEach(condition => {
    const parts = formatSessionCondition(condition)
    if (parts.length > 0) {
      sessionConditionStrings.push(combineConditionParts(parts))
    }
  })
  
  if (sessionConditionStrings.length === 0) {
    return null
  }
  
  return combineConditionsWithOperators(sessionConditionStrings, sessionConditions.operators)
}

export function validateCelExpression(celExpression: string): boolean {
  if (!celExpression || celExpression.trim() === '') {
    return false
  }
  
  const hasBalancedParentheses = (expr: string): boolean => {
    let count = 0
    for (const char of expr) {
      if (char === '(') count++
      if (char === ')') count--
      if (count < 0) return false
    }
    return count === 0
  }
  
  return hasBalancedParentheses(celExpression)
}

export function getDefaultOperatorForType(type: string): string {
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
