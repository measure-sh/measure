/**
 * Converts UI state conditions into Common 
 * Expression Language (CEL) strings.
 * 
 * This is the reverse of the CEL parser, used to 
 * regenerate CEL expressions for filtering and 
 * evaluation.
 */

import { EventCondition, AttributeCondition, TraceCondition, EventConditions, SessionConditions, TraceConditions } from "./conditions"
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
    key: string;
    type: string;
    value: string | boolean | number;
    operator?: string
  },
  eventType: string
): string {
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
  key: string;
  type: string;
  value: string | boolean | number;
  operator?: string
}): string {
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
  key: string;
  type: string;
  value: string | boolean | number;
  operator?: string
}): string {
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
  key: string;
  type: string;
  value: string | boolean | number;
  operator?: string
}): string {
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

  condition.attrs?.forEach(attr =>
    parts.push(createEventAttributeCondition(attr, condition.type))
  )

  condition.ud_attrs?.forEach(attr =>
    parts.push(createUserDefinedEventAttributeCondition(attr))
  )

  condition.session_attrs?.forEach(attr =>
    parts.push(createSessionAttributeCondition(attr))
  )

  return parts
}

/**
 * Converts a single session condition object into an 
 * array of its constituent CEL parts.
 * Example output: ['attribute.session_duration > 300', 'attribute.user_country == "US"']
 */
function buildSessionConditionParts(condition: AttributeCondition): string[] {
  return condition.attrs?.map(createSessionAttributeCondition) || []
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

  condition.ud_attrs?.forEach(attr =>
    parts.push(createSpanUserDefinedAttributeCondition(attr))
  )

  condition.session_attrs?.forEach(attr =>
    parts.push(createSessionAttributeCondition(attr))
  )

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
 * It builds, combines, and links all event conditions into a single CEL string.
 * Example output: '(event_type == "anr" && exception.handled == false) || (event_type == "crash")'
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
 * High-level processor for all session conditions.
 * It builds, combines, and links all session conditions into a single CEL string.
 * Example output: '(attribute.session_duration > 300) && (attribute.user_country == "US")'
 */
function processSessionConditions(sessionConditions: SessionConditions | undefined): string | null {
  if (!sessionConditions?.conditions?.length) return null

  const conditionStrings = sessionConditions.conditions
    .map(buildSessionConditionParts)
    .filter(parts => parts.length > 0)
    .map(combineConditionParts)

  return conditionStrings.length > 0
    ? combineConditionsWithLogicalOperators(conditionStrings, sessionConditions.operators || [])
    : null
}

/**
 * High-level processor for all trace conditions.
 * Example output: '(span_name.contains("HTTP")) || (trace.user_defined_attrs.is_critical == true)'
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
 * Each group is individually wrapped in parentheses.
 */
function wrapConditionGroups(conditionGroups: string[]): string {
  if (conditionGroups.length === 0) return ''

  if (conditionGroups.length === 1) {
    return `(${conditionGroups[0]})`
  }

  const wrappedGroups = conditionGroups.map(group => `(${group})`)
  return wrappedGroups.join(' && ')
}

/**
 * Converts a structured `ParsedConditions` object into a final CEL expression string.
 * This is the main entry point for the CEL generation logic.
 */
export function conditionsToCel(parsedConditions: ParsedConditions): string | null {
  const eventCelExpression = processEventConditions(parsedConditions.event)
  const traceCelExpression = processTraceConditions(parsedConditions.trace)
  const sessionCelExpression = processSessionConditions(parsedConditions.session)

  const conditionGroups = [eventCelExpression, traceCelExpression, sessionCelExpression]
    .filter((group): group is string => Boolean(group))

  if (conditionGroups.length === 0) {
    return null
  }

  return wrapConditionGroups(conditionGroups)
}