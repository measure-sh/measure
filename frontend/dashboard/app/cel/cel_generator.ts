/**
 * CEL (Common Expression Language) Generator
 * 
 * This module generates CEL expressions from structured condition objects.
 * It converts event, session, and trace conditions back into valid CEL syntax
 * that can be used for filtering and evaluation.
 */

import { EventCondition, SessionCondition, TraceCondition, EventConditions, SessionConditions, TraceConditions } from "../types/session-targeting-types"
import { ParsedConditions } from "./cel_parser"

/**
 * Maps internal operators to CEL operators
 */
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

/**
 * Maps logical operators to CEL syntax
 */
const LOGICAL_OPERATOR_MAPPINGS = {
  AND: '&&',
  OR: '||'
} as const

/**
 * Formats a value according to its type for CEL syntax
 * @param value The value to format
 * @param type The type of the value
 * @returns Formatted value string
 */
function formatValueForCel(value: string | boolean | number, type: string): string {
  return type === 'string' ? `"${value}"` : String(value)
}

/**
 * Generates a CEL condition for event type matching
 * @param eventType The event type to match
 * @returns CEL expression string
 */
function createEventTypeCondition(eventType: string): string {
  return `event_type == "${eventType}"`
}

/**
 * Generates a CEL condition for event attributes
 * @param attribute The attribute configuration
 * @param eventType The event type to use as prefix (required)
 * @returns CEL expression string
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
 * Generates a CEL condition for user-defined event attributes
 * @param attribute The user-defined attribute configuration
 * @returns CEL expression string
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
 * Generates a CEL condition for session attributes
 * @param attribute The session attribute configuration
 * @returns CEL expression string
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
 * Generates a CEL condition for span names
 * @param spanName The span name to match
 * @param operator The comparison operator
 * @returns CEL expression string
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
 * Generates a CEL condition for span user-defined attributes
 * @param attribute The span user-defined attribute configuration
 * @returns CEL expression string
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
 * Converts a single event condition into CEL expressions
 * @param condition The event condition to convert
 * @returns Array of CEL expression strings
 */
function buildEventConditionParts(condition: EventCondition): string[] {
  const parts: string[] = []

  // Add event type condition if not already specified in attributes
  const hasEventTypeAttribute = condition.attrs?.some(attr => attr.key === 'event_type')
  if (condition.type && !hasEventTypeAttribute) {
    parts.push(createEventTypeCondition(condition.type))
  }

  // Add event attributes
  condition.attrs?.forEach(attr =>
    parts.push(createEventAttributeCondition(attr, condition.type))
  )

  // Add user-defined attributes
  condition.ud_attrs?.forEach(attr =>
    parts.push(createUserDefinedEventAttributeCondition(attr))
  )

  return parts
}

/**
 * Converts a single session condition into CEL expressions
 * @param condition The session condition to convert
 * @returns Array of CEL expression strings
 */
function buildSessionConditionParts(condition: SessionCondition): string[] {
  return condition.attrs?.map(createSessionAttributeCondition) || []
}

/**
 * Converts a single trace condition into CEL expressions
 * @param condition The trace condition to convert
 * @returns Array of CEL expression strings
 */
function buildTraceConditionParts(condition: TraceCondition): string[] {
  const parts: string[] = []

  // Add span name condition
  if (condition.spanName) {
    parts.push(createSpanNameCondition(condition.spanName, condition.operator))
  }

  // Add user-defined attributes
  condition.ud_attrs?.forEach(attr =>
    parts.push(createSpanUserDefinedAttributeCondition(attr))
  )

  return parts
}

/**
 * Combines multiple condition parts with AND operators
 * @param parts Array of condition parts to combine
 * @returns Combined CEL expression or empty string
 */
function combineConditionParts(parts: string[]): string {
  if (parts.length === 0) return ''
  return parts.join(' && ')
}

/**
 * Combines multiple conditions with specified logical operators
 * @param conditions Array of condition strings
 * @param operators Array of logical operators (AND/OR)
 * @returns Combined CEL expression with proper parentheses
 */
function combineConditionsWithLogicalOperators(
  conditions: string[],
  operators: ('AND' | 'OR')[]
): string {
  if (conditions.length === 0) return ''
  if (conditions.length === 1) return conditions[0]

  // Wrap each condition in parentheses for correct precedence
  let result = `(${conditions[0]})`

  for (let i = 0; i < operators.length && i + 1 < conditions.length; i++) {
    const celOperator = LOGICAL_OPERATOR_MAPPINGS[operators[i]]
    result = `${result} ${celOperator} (${conditions[i + 1]})`
  }

  return result
}

/**
 * Processes event conditions into CEL expressions
 * @param eventConditions The event conditions to process
 * @returns CEL expression string or null if no conditions
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
 * Processes session conditions into CEL expressions
 * @param sessionConditions The session conditions to process
 * @returns CEL expression string or null if no conditions
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
 * Processes trace conditions into CEL expressions
 * @param traceConditions The trace conditions to process
 * @returns CEL expression string or null if no conditions
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
 * Wraps condition groups with appropriate parentheses based on count
 * @param conditionGroups Array of condition group strings
 * @returns Final CEL expression with proper parentheses
 */
function wrapConditionGroups(conditionGroups: string[]): string {
  if (conditionGroups.length === 0) return ''

  if (conditionGroups.length === 1) {
    // Single condition group gets one level of parentheses
    return `(${conditionGroups[0]})`
  }

  // Multiple condition groups get individual wrapping then AND combination
  const wrappedGroups = conditionGroups.map(group => `(${group})`)
  return wrappedGroups.join(' && ')
}

/**
 * Generates a CEL rule from structured condition objects
 * 
 * This function takes event, trace, and session conditions and converts them
 * into a single CEL expression string that can be used for filtering.
 * 
 * @param parsedConditions The parsed conditions
 * @returns CEL expression string or null if no conditions provided
 */
export function conditionsToCel(parsedConditions: ParsedConditions): string | null {
  // Process each condition type into CEL expressions
  const eventCelExpression = processEventConditions(parsedConditions.event)
  const traceCelExpression = processTraceConditions(parsedConditions.trace)
  const sessionCelExpression = processSessionConditions(parsedConditions.session)

  // Collect non-empty condition groups
  const conditionGroups = [eventCelExpression, traceCelExpression, sessionCelExpression]
    .filter((group): group is string => Boolean(group))

  // Return null if no conditions
  if (conditionGroups.length === 0) {
    return null
  }

  // Wrap and combine condition groups
  return wrapConditionGroups(conditionGroups)
}