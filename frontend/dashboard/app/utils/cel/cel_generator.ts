/**
 * Converts UI state conditions into Common 
 * Expression Language (CEL) strings.
 * 
 * This is the reverse of the CEL parser, used to 
 * regenerate CEL expressions for filtering and 
 * evaluation.
 */

import {
  EventCondition,
  TraceCondition,
  EventConditions,
  TraceConditions
} from "./conditions"
import { ParsedConditions } from "./cel_parser"

const OPERATOR_MAPPINGS = {
  eq: '==',
  neq: '!=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  contains: 'contains',
  startsWith: 'startsWith'
} as const

const LOGICAL_OPERATOR_MAPPINGS = {
  AND: '&&',
  OR: '||'
} as const

/**
 * Formats a value for CEL syntax, wrapping strings in quotes.
 */
function formatValueForCel(value: string | boolean | number, type: string): string {
  return type === 'string' ? `"${value}"` : String(value)
}

/**
 * Creates a CEL expression for an event type.
 * Example output: 'event_type == "anr"'
 */
function createEventTypeCondition(eventType: string): string {
  return `event_type == "${eventType}"`
}

/**
 * Creates a CEL expression for a standard event attribute.
 * Example output: 'exception.handled == false'
 */
function createEventAttributeCondition(
  attribute: {
    key: string
    type: string
    value: string | boolean | number
    operator?: string
  },
  eventType: string
): string | null {
  if (attribute.value === '' || attribute.value === undefined || attribute.value === null) {
    return null
  }

  const operator = OPERATOR_MAPPINGS[attribute.operator as keyof typeof OPERATOR_MAPPINGS] || '=='
  const formattedValue = formatValueForCel(attribute.value, attribute.type)
  const fullKey = `${eventType}.${attribute.key}`

  if (attribute.type === 'string' && (operator === 'contains' || operator === 'startsWith')) {
    return `${fullKey}.${operator}(${formattedValue})`
  }

  return `${fullKey} ${operator} ${formattedValue}`
}

/**
 * Creates a CEL expression for a user-defined event attribute.
 * Example output: 'event.user_defined_attrs.is_premium == true'
 */
function createUserDefinedEventAttributeCondition(attribute: {
  key: string
  type: string
  value: string | boolean | number
  operator?: string
}): string | null {
  if (attribute.value === '' || attribute.value === undefined || attribute.value === null) {
    return null
  }

  const operator = OPERATOR_MAPPINGS[attribute.operator as keyof typeof OPERATOR_MAPPINGS] || '=='
  const formattedValue = formatValueForCel(attribute.value, attribute.type)
  const fullKey = `event.user_defined_attrs.${attribute.key}`

  if (attribute.type === 'string' && (operator === 'contains' || operator === 'startsWith')) {
    return `${fullKey}.${operator}(${formattedValue})`
  }

  return `${fullKey} ${operator} ${formattedValue}`
}

/**
 * Creates a CEL expression for a session attribute.
 * Example output: 'attribute.session_duration > 300'
 */
function createSessionAttributeCondition(attribute: {
  key: string
  type: string
  value: string | boolean | number
  operator?: string
}): string | null {
  if (attribute.value === '' || attribute.value === undefined || attribute.value === null) {
    return null
  }

  const operator = OPERATOR_MAPPINGS[attribute.operator as keyof typeof OPERATOR_MAPPINGS] || '=='
  const formattedValue = formatValueForCel(attribute.value, attribute.type)

  if (attribute.type === 'string' && (operator === 'contains' || operator === 'startsWith')) {
    return `attribute.${attribute.key}.${operator}(${formattedValue})`
  }

  return `attribute.${attribute.key} ${operator} ${formattedValue}`
}

/** 
 * Creates a CEL expression for a span name.
 * Example output: 'span_name.contains("HTTP")'
 */
function createSpanNameCondition(spanName: string, operator: string): string {
  const formattedValue = formatValueForCel(spanName, 'string')

  if (operator === 'contains' || operator === 'startsWith') {
    return `span_name.${operator}(${formattedValue})`
  }

  const celOperator = OPERATOR_MAPPINGS[operator as keyof typeof OPERATOR_MAPPINGS] || '=='
  return `span_name ${celOperator} ${formattedValue}`
}

/**
 * Creates a CEL expression for a span's user-defined attribute.
 * Example output: 'trace.user_defined_attrs.is_critical == true'
 */
function createSpanUserDefinedAttributeCondition(attribute: {
  key: string
  type: string
  value: string | boolean | number
  operator?: string
}): string | null {
  if (attribute.value === '' || attribute.value === undefined || attribute.value === null) {
    return null
  }

  const operator = OPERATOR_MAPPINGS[attribute.operator as keyof typeof OPERATOR_MAPPINGS] || '=='
  const formattedValue = formatValueForCel(attribute.value, attribute.type)
  const fullKey = `trace.user_defined_attrs.${attribute.key}`

  if (attribute.type === 'string' && (operator === 'contains' || operator === 'startsWith')) {
    return `${fullKey}.${operator}(${formattedValue})`
  }

  return `${fullKey} ${operator} ${formattedValue}`
}

/**
 * Converts a single event condition object into an 
 * array of its constituent CEL parts.
 * Example output: ['event_type == "exception"', 'exception.handled == false']
 */
function buildEventConditionParts(condition: EventCondition): string[] {
  const parts: string[] = []

  if (condition.type) {
    parts.push(createEventTypeCondition(condition.type))
  }

  condition.attrs?.forEach(attr => {
    const expr = createEventAttributeCondition(attr, condition.type)
    if (expr) parts.push(expr)
  })

  condition.ud_attrs?.forEach(attr => {
    const expr = createUserDefinedEventAttributeCondition(attr)
    if (expr) parts.push(expr)
  })

  condition.session_attrs?.forEach(attr => {
    const expr = createSessionAttributeCondition(attr)
    if (expr) parts.push(expr)
  })

  return parts
}

/**
 * Converts a single trace condition object into an 
 * array of its constituent CEL parts.
 * Example output: ['span_name.contains("HTTP")', 'trace.user_defined_attrs.is_critical == true']
 */
function buildTraceConditionParts(condition: TraceCondition): string[] {
  const parts: string[] = []

  if (condition.spanName) {
    parts.push(createSpanNameCondition(condition.spanName, condition.operator))
  }

  condition.ud_attrs?.forEach(attr => {
    const expr = createSpanUserDefinedAttributeCondition(attr)
    if (expr) parts.push(expr)
  })

  condition.session_attrs?.forEach(attr => {
    const expr = createSessionAttributeCondition(attr)
    if (expr) parts.push(expr)
  })

  return parts
}

/**
 * Joins an array of CEL parts for a 
 * single condition using the AND (`&&`) operator.
 * Example output: 'part1 && part2 && part3'
 */
function combineConditionParts(parts: string[]): string {
  if (parts.length === 0) return ''
  return parts.join(' && ')
}

/**
 * Combines multiple completed condition strings 
 * using specified logical operators (`&&` or `||`).
 * Example output: '(cond1) && (cond2) || (cond3)'
 */
function combineConditionsWithLogicalOperators(
  conditions: string[],
  operators: ('AND' | 'OR')[]
): string {
  if (conditions.length === 0) return ''
  if (conditions.length === 1) return conditions[0]

  let result = `(${conditions[0]})`

  for (let i = 0; i < operators.length && i + 1 < conditions.length; i++) {
    const celOperator = LOGICAL_OPERATOR_MAPPINGS[operators[i]]
    result = `${result} ${celOperator} (${conditions[i + 1]})`
  }

  return result
}

/**
 * High-level processor for all event conditions.
 */
function processEventConditions(eventConditions: EventConditions | undefined): string | null {
  if (!eventConditions?.conditions?.length) return null

  const conditionStrings = eventConditions.conditions
    .map(buildEventConditionParts)
    .filter(parts => parts.length > 0)
    .map(combineConditionParts)

  return conditionStrings.length > 0
    ? combineConditionsWithLogicalOperators(conditionStrings, eventConditions.operators || [])
    : null
}

/**
 * High-level processor for all trace conditions.
 */
function processTraceConditions(traceConditions: TraceConditions | undefined): string | null {
  if (!traceConditions?.conditions?.length) return null

  const conditionStrings = traceConditions.conditions
    .map(buildTraceConditionParts)
    .filter(parts => parts.length > 0)
    .map(combineConditionParts)

  return conditionStrings.length > 0
    ? combineConditionsWithLogicalOperators(conditionStrings, traceConditions.operators || [])
    : null
}

/**
 * Wraps and joins the final event, session, and trace CEL groups with AND (`&&`).
 */
function wrapConditionGroups(conditionGroups: string[]): string {
  if (conditionGroups.length === 0) return ''
  if (conditionGroups.length === 1) {
    return `(${conditionGroups[0]})`
  }

  const wrappedGroups = conditionGroups.map(group => `(${group})`)
  const joined = wrappedGroups.join(' && ')
  // Wrap the entire combined expression in parentheses
  return `(${joined})`
}

/**
 * Converts a single EventCondition into a CEL expression string.
 */
export function eventConditionToCel(condition: EventCondition): string | null {
  const parts = buildEventConditionParts(condition)
  if (parts.length === 0) return null

  const combined = combineConditionParts(parts)
  return `(${combined})`
}

/**
 * Converts a single TraceCondition into a CEL expression string.
 */
export function traceConditionToCel(condition: TraceCondition): string | null {
  const parts = buildTraceConditionParts(condition)
  if (parts.length === 0) return null

  const combined = combineConditionParts(parts)
  return `(${combined})`
}

/**
 * Converts a structured `ParsedConditions` object into a final CEL expression string.
 */
export function conditionsToCel(parsedConditions: ParsedConditions): string | null {
  const eventCelExpression = processEventConditions(parsedConditions.event)
  const traceCelExpression = processTraceConditions(parsedConditions.trace)

  const conditionGroups = [eventCelExpression, traceCelExpression]
    .filter((group): group is string => Boolean(group))

  if (conditionGroups.length === 0) {
    return null
  }

  return wrapConditionGroups(conditionGroups)
}