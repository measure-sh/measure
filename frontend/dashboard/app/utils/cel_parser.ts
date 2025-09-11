import { EventConditions, SessionConditions, TraceConditions, EventCondition, SessionCondition, TraceCondition } from '../types/session-targeting-types'
import { CelTokenizer, Token, TokenType, CelParseError } from './cel_tokenizer'

export interface ParsedCelRules {
  eventConditions?: EventConditions
  sessionConditions?: SessionConditions  
  traceConditions?: TraceConditions
}

interface FieldPath {
  segments: string[]
  position: number
}

interface Literal {
  type: 'string' | 'number' | 'boolean' | 'null'
  value: string | number | boolean | null
  position: number
}

interface Comparison {
  field: FieldPath
  operator: string
  value: Literal
  position: number
}

interface LogicalExpression {
  left: Comparison | LogicalExpression
  operator: 'AND' | 'OR'
  right: Comparison | LogicalExpression
  position: number
}

type Expression = Comparison | LogicalExpression

// Parser
export class CelParser {
  private tokens: Token[]
  private position = 0
  
  // Result builders
  private eventConditions: EventCondition[] = []
  private sessionConditions: SessionCondition[] = []
  private traceConditions: TraceCondition[] = []
  
  private eventOperators: ('AND' | 'OR')[] = []
  private sessionOperators: ('AND' | 'OR')[] = []
  private traceOperators: ('AND' | 'OR')[] = []

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse(): ParsedCelRules {
    this.position = 0
    this.clearResults()
    
    try {
      const ast = this.parseExpression()
      this.convertAstToConditions(ast)
      
      if (!this.isAtEnd()) {
        throw new CelParseError(
          'Unexpected tokens after expression', 
          this.currentToken().position,
          this.currentToken().value
        )
      }

      return this.buildResult()
    } catch (error) {
      if (error instanceof CelParseError) {
        throw error
      }
      throw new CelParseError('Unknown parsing error', this.position)
    }
  }

  private clearResults(): void {
    this.eventConditions = []
    this.sessionConditions = []
    this.traceConditions = []
    this.eventOperators = []
    this.sessionOperators = []
    this.traceOperators = []
  }

  private parseExpression(): Expression {
    return this.parseOrExpression()
  }

  private parseOrExpression(): Expression {
    let left = this.parseAndExpression()

    while (this.match(TokenType.OR)) {
      const operator = 'OR'
      const operatorPos = this.previous().position
      const right = this.parseAndExpression()
      left = { left, operator, right, position: operatorPos }
    }

    return left
  }

  private parseAndExpression(): Expression {
    let left = this.parsePrimary()

    while (this.match(TokenType.AND)) {
      const operator = 'AND'
      const operatorPos = this.previous().position
      const right = this.parsePrimary()
      left = { left, operator, right, position: operatorPos }
    }

    return left
  }

  private parsePrimary(): Expression {
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression()
      this.consume(TokenType.RPAREN, 'Expected closing parenthesis')
      return expr
    }

    return this.parseComparison()
  }

  private parseComparison(): Comparison {
    const field = this.parseFieldPath()
    const operator = this.parseComparisonOperator()
    const value = this.parseLiteral()

    // If this was a method call (contains, startsWith), consume the closing parenthesis
    if (operator === 'contains' || operator === 'startsWith') {
      this.consume(TokenType.RPAREN, `Expected closing parenthesis after ${operator} method call`)
    }

    return {
      field,
      operator,
      value,
      position: field.position
    }
  }

  private parseFieldPath(): FieldPath {
    const startPos = this.currentToken().position
    const segments: string[] = []

    if (!this.check(TokenType.IDENTIFIER)) {
      throw new CelParseError(
        'Expected field name',
        this.currentToken().position,
        this.currentToken().value,
        ['identifier']
      )
    }

    segments.push(this.advance().value)

    while (this.match(TokenType.DOT)) {
      if (this.check(TokenType.CONTAINS) || this.check(TokenType.STARTS_WITH)) {
        // This is a method call, handle it as operator
        break
      }
      
      if (!this.check(TokenType.IDENTIFIER)) {
        throw new CelParseError(
          'Expected field name after dot',
          this.currentToken().position,
          this.currentToken().value,
          ['identifier']
        )
      }
      
      segments.push(this.advance().value)
    }

    return { segments, position: startPos }
  }

  private parseComparisonOperator(): string {
    const token = this.currentToken()

    // Handle method calls
    if (this.match(TokenType.CONTAINS, TokenType.STARTS_WITH)) {
      const methodName = this.previous().value
      this.consume(TokenType.LPAREN, `Expected opening parenthesis after ${methodName}`)
      return methodName
    }

    // Handle regular operators
    if (this.match(
      TokenType.EQUALS, TokenType.NOT_EQUALS,
      TokenType.GREATER_THAN, TokenType.LESS_THAN,
      TokenType.GREATER_EQUAL, TokenType.LESS_EQUAL
    )) {
      return this.tokenTypeToOperator(this.previous().type)
    }

    throw new CelParseError(
      'Expected comparison operator',
      token.position,
      token.value,
      ['==', '!=', '>', '<', '>=', '<=', 'contains', 'startsWith']
    )
  }

  private parseLiteral(): Literal {
    const token = this.currentToken()

    if (this.match(TokenType.STRING)) {
      return {
        type: 'string',
        value: this.previous().value,
        position: token.position
      }
    }

    if (this.match(TokenType.NUMBER)) {
      return {
        type: 'number',
        value: parseFloat(this.previous().value),
        position: token.position
      }
    }

    if (this.match(TokenType.BOOLEAN)) {
      return {
        type: 'boolean',
        value: this.previous().value === 'true',
        position: token.position
      }
    }

    if (this.match(TokenType.NULL)) {
      return {
        type: 'null',
        value: null,
        position: token.position
      }
    }

    // Handle closing parenthesis for method calls
    if (this.match(TokenType.RPAREN)) {
      // This was the end of a method call, backtrack to get the actual argument
      throw new CelParseError(
        'Expected argument for method call',
        token.position,
        token.value,
        ['string', 'number', 'boolean', 'null']
      )
    }

    throw new CelParseError(
      'Expected literal value',
      token.position,
      token.value,
      ['string', 'number', 'boolean', 'null']
    )
  }

  // Helper methods
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance()
        return true
      }
    }
    return false
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false
    return this.currentToken().type === type
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.position++
    return this.previous()
  }

  private isAtEnd(): boolean {
    return this.currentToken().type === TokenType.EOF
  }

  private previous(): Token {
    return this.tokens[this.position - 1]
  }

  private currentToken(): Token {
    return this.tokens[this.position]
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance()

    const token = this.currentToken()
    throw new CelParseError(
      message,
      token.position,
      token.value,
      [type]
    )
  }

  private tokenTypeToOperator(type: TokenType): string {
    switch (type) {
      case TokenType.EQUALS: return 'eq'
      case TokenType.NOT_EQUALS: return 'neq'
      case TokenType.GREATER_THAN: return 'gt'
      case TokenType.LESS_THAN: return 'lt'
      case TokenType.GREATER_EQUAL: return 'gte'
      case TokenType.LESS_EQUAL: return 'lte'
      default: return 'eq'
    }
  }

  // Convert AST to target condition format
  private convertAstToConditions(expr: Expression): void {
    this.processExpression(expr, [])
  }

  private processExpression(expr: Expression, operators: ('AND' | 'OR')[]): void {
    if (this.isLogicalExpression(expr)) {
      // Logical expression
      this.processExpression(expr.left, operators)
      operators.push(expr.operator)
      this.processExpression(expr.right, operators)
    } else {
      // Comparison
      this.processComparison(expr, operators)
    }
  }

  private isLogicalExpression(expr: Expression): expr is LogicalExpression {
    return 'operator' in expr && (expr.operator === 'AND' || expr.operator === 'OR')
  }

  private processComparison(comparison: Comparison, operators: ('AND' | 'OR')[]): void {
    const category = this.categorizeField(comparison.field.segments)
    
    switch (category) {
      case 'event':
        this.addEventCondition(comparison)
        if (operators.length > 0) {
          this.eventOperators.push(...operators)
          operators.length = 0
        }
        break
      case 'session':
        this.addSessionCondition(comparison)
        if (operators.length > 0) {
          this.sessionOperators.push(...operators)
          operators.length = 0
        }
        break
      case 'trace':
        this.addTraceCondition(comparison)
        if (operators.length > 0) {
          this.traceOperators.push(...operators)
          operators.length = 0
        }
        break
    }
  }

  private categorizeField(segments: string[]): 'event' | 'session' | 'trace' {
    if (segments[0] === 'event_type') {
      return 'event'
    }
    if (segments[0] === 'attribute') {
      return 'session'
    }
    if (segments[0] === 'span') {
      return 'trace'
    }
  
    // Default to event to access event-specific attributes
    return 'event'
  }

  private addEventCondition(comparison: Comparison): void {
    const segments = comparison.field.segments
    
    if (segments[0] === 'event_type') {
      if (comparison.operator !== 'eq') {
        throw new CelParseError(
          `event_type only supports == operator, got ${comparison.operator}`,
          comparison.position
        )
      }
      
      // Find or create condition with this event type
      const eventType = comparison.value.value as string
      let condition = this.eventConditions.find(c => c.type === eventType)
      
      if (!condition) {
        condition = {
          id: crypto.randomUUID(),
          type: eventType,
          attrs: [],
          ud_attrs: []
        }
        this.eventConditions.push(condition)
      }
    } else if (segments[0] === 'user_defined_attrs') {
      // User-defined attribute
      const key = segments[1]
      const condition = this.eventConditions[this.eventConditions.length - 1]
      
      if (comparison.value.value === null) {
        throw new CelParseError(
          'Null values not supported for user-defined attributes',
          comparison.position
        )
      }
      
      condition.ud_attrs!.push({
        id: crypto.randomUUID(),
        key,
        type: comparison.value.type === 'boolean' ? 'bool' : comparison.value.type,
        value: comparison.value.value as string | number | boolean,
        operator: comparison.operator
      })
    } else {
      // Event-specific attribute (e.g., exception.handled)
      const eventType = segments[0]
      const key = segments[1]
      
      let condition = this.eventConditions.find(c => c.type === eventType)
      if (!condition) {
        condition = {
          id: crypto.randomUUID(),
          type: eventType,
          attrs: [],
          ud_attrs: []
        }
        this.eventConditions.push(condition)
      }
      
      if (comparison.value.value === null) {
        throw new CelParseError(
          'Null values not supported for event attributes',
          comparison.position
        )
      }
      
      condition.attrs!.push({
        id: crypto.randomUUID(),
        key,
        type: comparison.value.type === 'boolean' ? 'bool' : comparison.value.type,
        value: comparison.value.value as string | number | boolean,
        operator: comparison.operator
      })
    }
  }

  private addSessionCondition(comparison: Comparison): void {
    const key = comparison.field.segments[comparison.field.segments.length - 1]
    
    if (comparison.value.value === null) {
      throw new CelParseError(
        'Null values not supported for session attributes',
        comparison.position
      )
    }
    
    this.sessionConditions.push({
      id: crypto.randomUUID(),
      attrs: [{
        id: crypto.randomUUID(),
        key,
        type: comparison.value.type === 'boolean' ? 'bool' : comparison.value.type,
        value: comparison.value.value as string | number | boolean,
        operator: comparison.operator
      }]
    })
  }

  private addTraceCondition(comparison: Comparison): void {
    if (comparison.field.segments[1] === 'name') {
      const condition = this.traceConditions[this.traceConditions.length - 1]
      condition.spanName = comparison.value.value as string
    } else {
      const key = comparison.field.segments[2]
      const condition = this.traceConditions[this.traceConditions.length - 1]
      
      if (comparison.value.value === null) {
        throw new CelParseError(
          'Null values not supported for trace user-defined attributes',
          comparison.position
        )
      }
      
      condition.ud_attrs!.push({
        id: crypto.randomUUID(),
        key,
        type: comparison.value.type === 'boolean' ? 'bool' : comparison.value.type,
        value: comparison.value.value as string | number | boolean,
        operator: comparison.operator
      })
    }
  }

  private buildResult(): ParsedCelRules {
    const result: ParsedCelRules = {}

    if (this.eventConditions.length > 0) {
      result.eventConditions = {
        conditions: this.eventConditions,
        operators: this.eventOperators
      }
    }

    if (this.sessionConditions.length > 0) {
      result.sessionConditions = {
        conditions: this.sessionConditions,
        operators: this.sessionOperators
      }
    }

    if (this.traceConditions.length > 0) {
      result.traceConditions = {
        conditions: this.traceConditions,
        operators: this.traceOperators
      }
    }

    return result
  }
}

// Main API
export function parseCel(expression: string): ParsedCelRules {
  if (!expression || !expression.trim()) {
    throw new CelParseError('Empty expression', 0)
  }

  try {
    const tokenizer = new CelTokenizer(expression)
    const tokens = tokenizer.tokenize()
    
    const parser = new CelParser(tokens)
    return parser.parse()
  } catch (error) {
    if (error instanceof CelParseError) {
      throw error
    }
    throw new CelParseError('Failed to parse CEL expression', 0)
  }
}