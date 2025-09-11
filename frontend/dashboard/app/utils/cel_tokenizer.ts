// Enhanced error types for better debugging
export class CelParseError extends Error {
  constructor(
    message: string,
    public position: number,
    public token?: string,
    public expected?: string[]
  ) {
    super(`${message} at position ${position}${token ? ` (found: '${token}')` : ''}${expected ? ` (expected: ${expected.join(' or ')})` : ''}`)
    this.name = 'CelParseError'
  }
}

// Token types
export enum TokenType {
  // Literals
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',

  // Operators
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  GREATER_EQUAL = 'GREATER_EQUAL',
  LESS_EQUAL = 'LESS_EQUAL',

  // String operations
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',

  // Logical
  AND = 'AND',
  OR = 'OR',

  // Punctuation
  DOT = 'DOT',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  COMMA = 'COMMA',

  // Special
  EOF = 'EOF'
}

export interface Token {
  type: TokenType
  value: string
  position: number
}

// Tokenizer
export class CelTokenizer {
  private input: string
  private position = 0
  private tokens: Token[] = []

  constructor(input: string) {
    this.input = input.trim()
  }

  tokenize(): Token[] {
    this.position = 0
    this.tokens = []

    while (this.position < this.input.length) {
      this.skipWhitespace()

      if (this.position >= this.input.length) break

      const char = this.input[this.position]
      const startPos = this.position

      // Multi-character operators
      if (this.position + 1 < this.input.length) {
        const twoChar = this.input.slice(this.position, this.position + 2);
        const tokenType = this.getTwoCharTokenType(twoChar)
        if (tokenType) {
          this.tokens.push({ type: tokenType, value: twoChar, position: startPos })
          this.position += 2
          continue
        }
      }

      // Single character tokens
      const singleTokenType = this.getSingleCharTokenType(char)
      if (singleTokenType) {
        this.tokens.push({ type: singleTokenType, value: char, position: startPos })
        this.position++
        continue
      }

      // String literals
      if (char === '"') {
        const stringValue = this.parseStringLiteral()
        this.tokens.push({ type: TokenType.STRING, value: stringValue, position: startPos })
        continue
      }

      // Numbers
      if (/\d/.test(char)) {
        const numberValue = this.parseNumber()
        this.tokens.push({ type: TokenType.NUMBER, value: numberValue, position: startPos })
        continue
      }

      // Identifiers and keywords
      if (/[a-zA-Z_]/.test(char)) {
        const identifier = this.parseIdentifier()
        const tokenType = this.getKeywordTokenType(identifier)
        this.tokens.push({ type: tokenType, value: identifier, position: startPos })
        continue
      }

      throw new CelParseError(`Unexpected character '${char}'`, this.position)
    }

    this.tokens.push({ type: TokenType.EOF, value: '', position: this.position })
    return this.tokens
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++
    }
  }

  private getTwoCharTokenType(twoChar: string): TokenType | null {
    switch (twoChar) {
      case '==': return TokenType.EQUALS
      case '!=': return TokenType.NOT_EQUALS
      case '>=': return TokenType.GREATER_EQUAL
      case '<=': return TokenType.LESS_EQUAL
      case '&&': return TokenType.AND
      case '||': return TokenType.OR
      default: return null
    }
  }

  private getSingleCharTokenType(char: string): TokenType | null {
    switch (char) {
      case '(': return TokenType.LPAREN
      case ')': return TokenType.RPAREN
      case '.': return TokenType.DOT
      case ',': return TokenType.COMMA
      case '>': return TokenType.GREATER_THAN
      case '<': return TokenType.LESS_THAN
      default: return null
    }
  }

  private getKeywordTokenType(identifier: string): TokenType {
    switch (identifier) {
      case 'true':
      case 'false':
        return TokenType.BOOLEAN
      case 'null':
        return TokenType.NULL
      case 'contains':
        return TokenType.CONTAINS
      case 'startsWith':
        return TokenType.STARTS_WITH
      default:
        return TokenType.IDENTIFIER
    }
  }

  private parseStringLiteral(): string {
    this.position++ // Skip opening quote
    let value = ''

    while (this.position < this.input.length && this.input[this.position] !== '"') {
      if (this.input[this.position] === '\\' && this.position + 1 < this.input.length) {
        // Handle escape sequences
        this.position++
        switch (this.input[this.position]) {
          case 'n': value += '\n'; break
          case 't': value += '\t'; break
          case 'r': value += '\r'; break
          case '\\': value += '\\'; break
          case '"': value += '"'; break
          default: value += this.input[this.position]; break
        }
      } else {
        value += this.input[this.position]
      }
      this.position++
    }

    if (this.position >= this.input.length) {
      throw new CelParseError('Unterminated string literal', this.position - value.length - 1)
    }

    this.position++
    return value
  }

  private parseNumber(): string {
    let value = ''
    let hasDecimal = false

    while (this.position < this.input.length) {
      const char = this.input[this.position]
      if (/\d/.test(char)) {
        value += char
        this.position++
      } else if (char === '.' && !hasDecimal) {
        hasDecimal = true
        value += char
        this.position++
      } else {
        break
      }
    }

    return value
  }

  private parseIdentifier(): string {
    let value = ''

    while (this.position < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.position])) {
      value += this.input[this.position]
      this.position++
    }

    return value
  }
}