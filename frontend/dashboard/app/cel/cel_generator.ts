/**
 * @fileoverview Converts structured condition objects into Common Expression Language (CEL) strings.
 * This is the reverse of the CEL parser, used to regenerate CEL expressions for filtering and evaluation.
 */

import { EventCondition, SessionCondition, TraceCondition, EventConditions, SessionConditions, TraceConditions } from "../types/session-targeting-types"
import { ParsedConditions } from "./cel_parser"

/** Maps internal operators to their CEL string representation. */
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

/** Maps logical operators to their CEL string representation. */
const LOGICAL_OPERATOR_MAPPINGS = {
  AND: '&&',
  OR: '||'
} as const

/**
 * Formats a value for CEL syntax, wrapping strings in quotes.
 * @param value The value to format.
 * @param type The data type of the value ('string', 'number', 'boolean').
 * @returns The value formatted as a CEL literal.
 */
function formatValueForCel(value: string | boolean | number, type: string): string {
  return type === 'string' ? `"${value}"` : String(value)
}

/**
 * Creates a CEL expression for an event type.
 * @example createEventTypeCondition("page_view") -> 'event_type == "page_view"'
 */
function createEventTypeCondition(eventType: string): string {
  return `event_type == "${eventType}"`
}

/**
 * Creates a CEL expression for a standard event attribute.
 * @param attribute The attribute definition.
 * @param eventType The parent event type, used as a prefix (e.g., 'page_view').
 * @returns A complete CEL expression for the attribute.
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
 * The keys are prefixed with `event.user_defined_attrs`.
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
 * These are prefixed with `attribute`.
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
 * These are prefixed with `span_name`.
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
 * These are prefixed with `trace.user_defined_attrs`.
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
 * Converts a single event condition object into an array of its constituent CEL parts.
 * @param condition A single `EventCondition` object.
 * @returns An array of CEL expression strings (e.g., ['event_type == "A"', 'A.key == "val"']).
 */
function buildEventConditionParts(condition: EventCondition): string[] {
  const parts: string[] = []

  const hasEventTypeAttribute = condition.attrs?.some(attr => attr.key === 'event_type')
  if (condition.type && !hasEventTypeAttribute) {
    parts.push(createEventTypeCondition(condition.type))
  }

  condition.attrs?.forEach(attr =>
    parts.push(createEventAttributeCondition(attr, condition.type))
  )

  condition.ud_attrs?.forEach(attr =>
    parts.push(createUserDefinedEventAttributeCondition(attr))
  )

  return parts
}

/**
 * Converts a single session condition object into an array of its constituent CEL parts.
 * @param condition A single `SessionCondition` object.
 * @returns An array of CEL expression strings.
 */
function buildSessionConditionParts(condition: SessionCondition): string[] {
  return condition.attrs?.map(createSessionAttributeCondition) || []
}

/**
 * Converts a single trace condition object into an array of its constituent CEL parts.
 * @param condition A single `TraceCondition` object.
 * @returns An array of CEL expression strings.
 */
function buildTraceConditionParts(condition: TraceCondition): string[] {
  const parts: string[] = []

  if (condition.spanName) {
    parts.push(createSpanNameCondition(condition.spanName, condition.operator))
  }

  condition.ud_attrs?.forEach(attr =>
    parts.push(createSpanUserDefinedAttributeCondition(attr))
  )

  return parts
}

/**
 * Joins an array of CEL parts for a single condition using the AND (`&&`) operator.
 * @param parts An array of CEL strings from a `build...ConditionParts` function.
 * @returns A single, combined CEL string for one condition block.
 */
function combineConditionParts(parts: string[]): string {
  if (parts.length === 0) return ''
  return parts.join(' && ')
}

/**
 * Combines multiple completed condition strings using specified logical operators (`&&` or `||`).
 * Each individual condition is wrapped in parentheses to ensure correct precedence.
 * @example combineConditionsWithLogicalOperators(['a > 1', 'b < 2'], ['OR']) -> '(a > 1) || (b < 2)'
 * @param conditions An array of complete condition strings.
 * @param operators An array of 'AND' or 'OR' strings.
 * @returns A final CEL expression for the condition group.
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
 * @returns A complete CEL string for the event block, or `null` if empty.
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
 * @returns A complete CEL string for the session block, or `null` if empty.
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
 * It builds, combines, and links all trace conditions into a single CEL string.
 * @returns A complete CEL string for the trace block, or `null` if empty.
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
 * @example wrapConditionGroups(['event_cel', 'session_cel']) -> '((event_cel)) && ((session_cel))'
 * @param conditionGroups An array containing the final CEL strings for events, traces, and/or sessions.
 * @returns The final, combined CEL string.
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
 *
 * @param parsedConditions The structured object containing event, trace, and session conditions.
 * @returns A complete CEL expression string, or `null` if no conditions are provided.
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