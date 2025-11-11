/**
 * CEL (Common Expression Language) Parser
 * 
 * This module parses tokenized CEL expressions into structured condition objects
 * that can be used for event, session, and trace filtering. It builds an Abstract
 * Syntax Tree (AST) and converts it into domain-specific condition formats.
 */

import { EventConditions, TraceConditions, EventCondition, TraceCondition } from './conditions'
import { CelTokenizer, Token, TokenType, CelParseError } from './cel_tokenizer'

/**
 * Result of parsing a CEL expression
 */
export interface ParsedConditions {
  event?: EventConditions
  trace?: TraceConditions
}

/**
 * Represents a field path like "event.user_defined_attrs.key"
 */
interface FieldPath {
  segments: string[]
  position: number
}

/**
 * Represents a literal value in the expression
 */
interface Literal {
  type: 'string' | 'number' | 'boolean' | 'null'
  value: string | number | boolean | null
  position: number
}

/**
 * Represents a comparison operation (field operator value)
 */
interface Comparison {
  field: FieldPath
  operator: string
  value: Literal
  position: number
}

/**
 * Represents a logical operation (AND/OR) between expressions
 */
interface LogicalExpression {
  left: Comparison | LogicalExpression
  operator: 'AND' | 'OR'
  right: Comparison | LogicalExpression
  position: number
}

/**
 * Union type for all expression types
 */
type Expression = Comparison | LogicalExpression

/**
 * Context for tracking which condition type we're currently in
 */
interface ParsingContext {
  currentEventCondition?: EventCondition
  currentTraceCondition?: TraceCondition
}

/**
 * Parser for CEL expressions that builds structured condition objects
 */
class CelParser {
  private tokens: Token[]
  private currentPosition = 0
  private idGenerator = 0

  // Condition builders for different types
  private eventConditions: EventCondition[] = []
  private traceConditions: TraceCondition[] = []

  // Operator sequences for combining conditions
  private eventOperators: ('AND' | 'OR')[] = []
  private traceOperators: ('AND' | 'OR')[] = []

  // Track the current parsing context
  private context: ParsingContext = {}

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  /**
   * Parses the tokens into structured conditions
   * @returns Parsed conditions organized by type (event, session, trace)
   */
  parse(): ParsedConditions {
    this.resetState()

    try {
      const ast = this.parseExpression()
      this.convertAstToConditions(ast)
      this.validateParsingComplete()
      return this.buildResult()
    } catch (error) {
      return this.handleParsingError(error)
    }
  }

  /**
   * Resets parser state for a new parsing operation
   */
  private resetState(): void {
    this.currentPosition = 0
    this.idGenerator = 0
    this.clearConditions()
    this.context = {}
  }

  /**
   * Clears all condition arrays and operators
   */
  private clearConditions(): void {
    this.eventConditions = []
    this.traceConditions = []
    this.eventOperators = []
    this.traceOperators = []
  }

  /**
   * Parses the top-level expression (handles OR operations)
   */
  private parseExpression(): Expression {
    return this.parseOrExpression()
  }

  /**
   * Parses OR expressions (lowest precedence logical operator)
   */
  private parseOrExpression(): Expression {
    let left = this.parseAndExpression()

    while (this.consumeIfMatches(TokenType.OR)) {
      const operatorPos = this.previousToken().position
      const right = this.parseAndExpression()
      left = { left, operator: 'OR', right, position: operatorPos }
    }

    return left
  }

  /**
   * Parses AND expressions (higher precedence than OR)
   */
  private parseAndExpression(): Expression {
    let left = this.parsePrimaryExpression()

    while (this.consumeIfMatches(TokenType.AND)) {
      const operatorPos = this.previousToken().position
      const right = this.parsePrimaryExpression()
      left = { left, operator: 'AND', right, position: operatorPos }
    }

    return left
  }

  /**
   * Parses primary expressions (comparisons and parenthesized expressions)
   */
  private parsePrimaryExpression(): Expression {
    if (this.consumeIfMatches(TokenType.LPAREN)) {
      const expr = this.parseExpression()
      this.consumeExpected(TokenType.RPAREN, 'Expected closing parenthesis')
      return expr
    }

    return this.parseComparison()
  }

  /**
   * Parses a comparison expression (field operator value)
   */
  private parseComparison(): Comparison {
    const field = this.parseFieldPath()
    const operator = this.parseComparisonOperator()
    const value = this.parseLiteral()

    // Handle method call syntax (contains, startsWith)
    if (operator === 'contains' || operator === 'startsWith') {
      this.consumeExpected(TokenType.RPAREN, `Expected closing parenthesis after ${operator} method call`)
    }

    return { field, operator, value, position: field.position }
  }

  /**
   * Parses a field path like "event.user_defined_attrs.key"
   */
  private parseFieldPath(): FieldPath {
    const startPos = this.currentToken().position
    const segments: string[] = []

    this.validateIdentifierExpected()
    segments.push(this.advance().value)

    while (this.consumeIfMatches(TokenType.DOT)) {
      // Stop if we encounter method calls
      if (this.isCurrentToken(TokenType.CONTAINS) || this.isCurrentToken(TokenType.STARTS_WITH)) {
        break
      }

      this.validateIdentifierExpected()
      segments.push(this.advance().value)
    }

    return { segments, position: startPos }
  }

  /**
   * Parses comparison operators including method calls
   */
  private parseComparisonOperator(): string {
    const token = this.currentToken()

    // Method call operators
    if (this.consumeIfMatches(TokenType.CONTAINS, TokenType.STARTS_WITH)) {
      const methodName = this.previousToken().value
      this.consumeExpected(TokenType.LPAREN, `Expected opening parenthesis after ${methodName}`)
      return methodName
    }

    // Standard comparison operators
    if (this.consumeIfMatches(
      TokenType.EQUALS, TokenType.NOT_EQUALS,
      TokenType.GREATER_THAN, TokenType.LESS_THAN,
      TokenType.GREATER_EQUAL, TokenType.LESS_EQUAL
    )) {
      return this.convertTokenTypeToOperator(this.previousToken().type)
    }

    throw new CelParseError(
      'Expected comparison operator',
      token.position,
      token.value,
      ['==', '!=', '>', '<', '>=', '<=', 'contains', 'startsWith']
    )
  }

  /**
   * Parses literal values (strings, numbers, booleans, null)
   */
  private parseLiteral(): Literal {
    const token = this.currentToken()

    if (this.consumeIfMatches(TokenType.STRING)) {
      return { type: 'string', value: this.previousToken().value, position: token.position }
    }
    if (this.consumeIfMatches(TokenType.NUMBER)) {
      return { type: 'number', value: parseFloat(this.previousToken().value), position: token.position }
    }
    if (this.consumeIfMatches(TokenType.BOOLEAN)) {
      return { type: 'boolean', value: this.previousToken().value === 'true', position: token.position }
    }
    if (this.consumeIfMatches(TokenType.NULL)) {
      return { type: 'null', value: null, position: token.position }
    }

    throw new CelParseError(
      'Expected literal value',
      token.position,
      token.value,
      ['string', 'number', 'boolean', 'null']
    )
  }

  /**
   * Converts the AST into structured conditions
   */
  private convertAstToConditions(expr: Expression): void {
    this.processExpression(expr, [])
  }

  /**
   * Recursively processes expressions and builds conditions
   */
  private processExpression(expr: Expression, operators: ('AND' | 'OR')[]): void {
    if (this.isLogicalExpression(expr)) {
      this.processExpression(expr.left, operators)
      operators.push(expr.operator)
      this.processExpression(expr.right, operators)
    } else {
      this.processComparison(expr, operators)
    }
  }

  /**
   * Processes a comparison and adds it to the appropriate condition list
   */
  private processComparison(comparison: Comparison, operators: ('AND' | 'OR')[]): void {
    const category = this.categorizeFieldPath(comparison.field.segments)
    const previousCategory = this.getCurrentCategory()

    switch (category) {
      case 'event':
        this.addEventCondition(comparison)
        // Only transfer operators if we're continuing within the same category
        if (previousCategory === 'event' || previousCategory === null) {
          this.transferOperators(operators, this.eventOperators)
        } else {
          // Clear operators when switching categories (they connect different condition types)
          operators.length = 0
        }
        break
      case 'trace':
        this.addTraceCondition(comparison)
        // Only transfer operators if we're continuing within the same category
        if (previousCategory === 'trace' || previousCategory === null) {
          this.transferOperators(operators, this.traceOperators)
        } else {
          // Clear operators when switching categories (they connect different condition types)
          operators.length = 0
        }
        break
      case 'session':
        this.addSessionAttribute(comparison)
        // Session attributes don't transfer operators, but we need to clear them
        // to prevent them from accumulating when the next condition is processed
        operators.length = 0
        break
    }
  }

  /**
   * Gets the current category based on what type of condition we're processing
   */
  private getCurrentCategory(): 'event' | 'trace' | null {
    if (this.context.currentEventCondition) return 'event'
    if (this.context.currentTraceCondition) return 'trace'
    return null
  }

  /**
   * Determines the category of a field based on its path segments
   */
  private categorizeFieldPath(segments: string[]): 'event' | 'trace' | 'session' {
    const firstSegment = segments[0]

    if (firstSegment === 'event_type' || firstSegment === 'event') {
      return 'event'
    }
    if (firstSegment === 'span_name' || firstSegment === 'trace') {
      return 'trace'
    }
    if (firstSegment === 'attribute') {
      return 'session'
    }

    // Default to event for unknown fields
    return 'event'
  }

  /**
   * Adds an event condition based on the comparison
   */
  private addEventCondition(comparison: Comparison): void {
    const segments = comparison.field.segments

    if (segments[0] === 'event_type') {
      this.addEventTypeCondition(comparison)
    } else if (this.isUserDefinedEventAttribute(segments)) {
      this.addEventUserDefinedAttribute(comparison, segments)
    } else {
      this.addEventAttribute(comparison, segments)
    }
  }

  /**
   * Adds an event type condition
   */
  private addEventTypeCondition(comparison: Comparison): void {
    const eventType = comparison.value.value as string
    let condition = this.findEventConditionByType(eventType)

    if (!condition) {
      condition = this.createEventCondition(eventType)
      this.eventConditions.push(condition)
    }

    // Update context to track current event condition
    this.context.currentEventCondition = condition
    this.context.currentTraceCondition = undefined
  }

  /**
   * Adds a user-defined event attribute
   */
  private addEventUserDefinedAttribute(comparison: Comparison, segments: string[]): void {
    const key = segments.slice(2).join('.')
    const condition = this.getLastEventCondition()

    if (!condition) {
      throw new CelParseError('User-defined attribute found without a preceding event_type', comparison.position)
    }

    condition.ud_attrs!.push(this.createAttributeFromComparison(comparison, key))
  }

  /**
   * Adds a regular event attribute
   */
  private addEventAttribute(comparison: Comparison, segments: string[]): void {
    const eventType = segments[0] === 'event' ? segments[1] : segments[0]
    const fullPathKey = segments.join('.')

    let condition = this.findEventConditionByType(eventType)
    if (!condition) {
      condition = this.createEventCondition(eventType)
      this.eventConditions.push(condition)
    }

    condition.attrs!.push(this.createAttributeFromComparison(comparison, fullPathKey))
  }

  /**
   * Adds a trace condition
   */
  private addTraceCondition(comparison: Comparison): void {
    const segments = comparison.field.segments

    if (segments[0] === 'span_name') {
      this.addSpanNameCondition(comparison)
    } else if (this.isUserDefinedTraceAttribute(segments)) {
      this.addTraceUserDefinedAttribute(comparison, segments)
    }
  }

  /**
   * Adds a span name condition
   */
  private addSpanNameCondition(comparison: Comparison): void {
    const condition: TraceCondition = {
      id: this.generateId(),
      spanName: comparison.value.value as string,
      operator: comparison.operator,
      ud_attrs: [],
      session_attrs: [],
    }
    this.traceConditions.push(condition)

    // Update context to track current trace condition
    this.context.currentTraceCondition = condition
    this.context.currentEventCondition = undefined
  }

  /**
   * Adds a trace user-defined attribute
   */
  private addTraceUserDefinedAttribute(comparison: Comparison, segments: string[]): void {
    const currentCondition = this.getLastTraceCondition()
    if (!currentCondition) {
      throw new CelParseError('Trace attribute found without a preceding span name', comparison.position)
    }

    const fullPathKey = segments.join('.')
    currentCondition.ud_attrs!.push(this.createAttributeFromComparison(comparison, fullPathKey))
  }

  /**
   * Adds a session attribute to the current event or trace condition
   */
  private addSessionAttribute(comparison: Comparison): void {
    const segments = comparison.field.segments
    const key = segments.slice(1).join('.') // Remove 'attribute' prefix

    const attr = this.createAttributeFromComparison(comparison, key)

    // Add to current event condition if exists
    if (this.context.currentEventCondition) {
      this.context.currentEventCondition.session_attrs!.push(attr)
      return
    }

    // Add to current trace condition if exists
    if (this.context.currentTraceCondition) {
      this.context.currentTraceCondition.session_attrs!.push(attr)
      return
    }

    // If no current condition exists, add to the last event or trace condition
    const lastEventCondition = this.getLastEventCondition()
    const lastTraceCondition = this.getLastTraceCondition()

    if (lastEventCondition) {
      lastEventCondition.session_attrs!.push(attr)
    } else if (lastTraceCondition) {
      lastTraceCondition.session_attrs!.push(attr)
    } else {
      throw new CelParseError('Session attribute found without a preceding event or trace condition', comparison.position)
    }
  }

  // Helper methods for token management
  private consumeIfMatches(...types: TokenType[]): boolean {
    if (types.some(type => this.isCurrentToken(type))) {
      this.advance()
      return true
    }
    return false
  }

  private isCurrentToken(type: TokenType): boolean {
    return !this.isAtEnd() && this.currentToken().type === type
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.currentPosition++
    return this.previousToken()
  }

  private isAtEnd(): boolean {
    return this.currentToken().type === TokenType.EOF
  }

  private currentToken(): Token {
    return this.tokens[this.currentPosition]
  }

  private previousToken(): Token {
    return this.tokens[this.currentPosition - 1]
  }

  private consumeExpected(type: TokenType, message: string): Token {
    if (this.isCurrentToken(type)) return this.advance()

    const token = this.currentToken()
    throw new CelParseError(message, token.position, token.value, [type])
  }

  // Helper methods for validation and utility
  private validateIdentifierExpected(): void {
    if (!this.isCurrentToken(TokenType.IDENTIFIER)) {
      const token = this.currentToken()
      throw new CelParseError(
        'Expected field name',
        token.position,
        token.value,
        ['identifier']
      )
    }
  }

  private validateParsingComplete(): void {
    if (!this.isAtEnd()) {
      const token = this.currentToken()
      throw new CelParseError(
        'Unexpected tokens after expression',
        token.position,
        token.value
      )
    }
  }

  private handleParsingError(error: unknown): ParsedConditions {
    if (error instanceof CelParseError) {
      console.error('CEL Parse Error:', error.message, 'at position', error.position, 'token:', error.token, 'expected:', error.expected)
    } else {
      console.error('Failed to parse CEL expression:', error)
    }
    return {}
  }

  private convertTokenTypeToOperator(type: TokenType): string {
    switch (type) {
      case TokenType.EQUALS:
        return 'eq'
      case TokenType.NOT_EQUALS:
        return 'neq'
      case TokenType.GREATER_THAN:
        return 'gt'
      case TokenType.LESS_THAN:
        return 'lt'
      case TokenType.GREATER_EQUAL:
        return 'gte'
      case TokenType.LESS_EQUAL:
        return 'lte'
      default:
        throw new CelParseError('Invalid comparison operator', this.currentToken().position, this.currentToken().value)
    }
  }

  // Helper methods for condition management
  private generateId(): string {
    return `id-${this.idGenerator++}`
  }

  private findEventConditionByType(eventType: string): EventCondition | undefined {
    return this.eventConditions.find(c => c.type === eventType)
  }

  private createEventCondition(eventType: string): EventCondition {
    return {
      id: this.generateId(),
      type: eventType,
      attrs: [],
      ud_attrs: [],
      session_attrs: [],
    }
  }

  private getLastEventCondition(): EventCondition | undefined {
    return this.eventConditions[this.eventConditions.length - 1]
  }

  private getLastTraceCondition(): TraceCondition | undefined {
    return this.traceConditions[this.traceConditions.length - 1]
  }

  private createAttributeFromComparison(comparison: Comparison, key: string) {
    const parsedKey = key.split('.').pop() || key
    return {
      id: this.generateId(),
      key: parsedKey,
      type: comparison.value.type === 'boolean' ? 'bool' : comparison.value.type,
      value: comparison.value.value as string | number | boolean,
      operator: comparison.operator
    }
  }

  private isUserDefinedEventAttribute(segments: string[]): boolean {
    return segments[0] === 'event' && segments[1] === 'user_defined_attrs'
  }

  private isUserDefinedTraceAttribute(segments: string[]): boolean {
    return (segments[0] === 'trace') && segments[1] === 'user_defined_attrs'
  }

  private isLogicalExpression(expr: Expression): expr is LogicalExpression {
    return 'operator' in expr && (expr.operator === 'AND' || expr.operator === 'OR')
  }

  private transferOperators(source: ('AND' | 'OR')[], target: ('AND' | 'OR')[]): void {
    if (source.length > 0) {
      target.push(...source)
      source.length = 0
    }
  }

  /**
   * Builds the final result from parsed conditions
   */
  private buildResult(): ParsedConditions {
    const result: ParsedConditions = {}

    if (this.eventConditions.length > 0) {
      result.event = { conditions: this.eventConditions, operators: this.eventOperators }
    }
    if (this.traceConditions.length > 0) {
      result.trace = { conditions: this.traceConditions, operators: this.traceOperators }
    }

    return result
  }
}

/**
 * Parses a CEL expression string into structured conditions
 */
export function celToConditions(expression: string): ParsedConditions {
  if (!expression?.trim()) {
    return { event: undefined, trace: undefined };
  }
  const tokenizer = new CelTokenizer(expression);
  const tokens = tokenizer.tokenize();
  const parser = new CelParser(tokens);
  return parser.parse();
}