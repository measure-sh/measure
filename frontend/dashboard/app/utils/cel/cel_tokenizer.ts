/**
 * CEL (Common Expression Language) Tokenizer
 * 
 * This module provides tokenization for CEL expressions, breaking down input strings
 * into meaningful tokens for parsing.
 */

/**
 * Error thrown during CEL parsing with detailed context information
 */
export class CelParseError extends Error {
  constructor(
    message: string,
    public position: number,
    public token?: string,
    public expected?: string[]
  ) {
    const contextInfo = token ? ` (found: '${token}')` : ''
    const expectedInfo = expected ? ` (expected: ${expected.join(' or ')})` : ''
    super(`${message} at position ${position}${contextInfo}${expectedInfo}`)
    this.name = 'CelParseError'
  }
}

/**
 * Token types supported by the CEL tokenizer
 */
export enum TokenType {
  // Literal values
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',

  // Comparison operators
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  GREATER_EQUAL = 'GREATER_EQUAL',
  LESS_EQUAL = 'LESS_EQUAL',

  // String methods
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',

  // Logical operators
  AND = 'AND',
  OR = 'OR',

  // Punctuation
  DOT = 'DOT',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  COMMA = 'COMMA',

  // End marker
  EOF = 'EOF'
}

/**
 * Represents a single token with its type, value, and position
 */
export interface Token {
  type: TokenType
  value: string
  position: number
}

/**
 * Tokenizes CEL expressions into a sequence of tokens
 */
export class CelTokenizer {
  private input: string
  private position = 0

  constructor(input: string) {
    this.input = input.trim()
  }

  /**
   * Tokenizes the input string into an array of tokens
   * @returns Array of tokens including EOF marker at the end
   */
  tokenize(): Token[] {
    const tokens: Token[] = []
    this.position = 0

    while (this.position < this.input.length) {
      this.skipWhitespace()
      if (this.position >= this.input.length) break

      const startPos = this.position
      const token = this.readNextToken()
      tokens.push({ ...token, position: startPos })
    }

    tokens.push({ type: TokenType.EOF, value: '', position: this.position })
    return tokens
  }

  /**
   * Reads and returns the next token from the input
   */
  private readNextToken(): Omit<Token, 'position'> {
    // Multi-character operators first
    const twoCharToken = this.tryReadTwoCharOperator()
    if (twoCharToken) return twoCharToken

    const char = this.currentChar()

    // Single character tokens
    const singleCharToken = this.tryReadSingleCharToken(char)
    if (singleCharToken) return singleCharToken

    // Complex tokens that require parsing
    if (char === '"') return { type: TokenType.STRING, value: this.readStringLiteral() }
    if (this.isDigit(char)) return { type: TokenType.NUMBER, value: this.readNumber() }
    if (this.isIdentifierStart(char)) {
      const identifier = this.readIdentifier()
      return { type: this.classifyIdentifier(identifier), value: identifier }
    }

    throw new CelParseError(`Unexpected character '${char}'`, this.position)
  }

  /**
   * Skips whitespace characters
   */
  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.currentChar())) {
      this.position++
    }
  }

  /**
   * Attempts to read a two-character operator
   */
  private tryReadTwoCharOperator(): Omit<Token, 'position'> | null {
    if (this.position + 1 >= this.input.length) return null

    const twoChar = this.input.slice(this.position, this.position + 2)
    const tokenType = this.getTwoCharOperatorType(twoChar)
    
    if (tokenType) {
      this.position += 2
      return { type: tokenType, value: twoChar }
    }
    
    return null
  }

  /**
   * Maps two-character sequences to their token types
   */
  private getTwoCharOperatorType(twoChar: string): TokenType | null {
    const operators: Record<string, TokenType> = {
      '==': TokenType.EQUALS,
      '!=': TokenType.NOT_EQUALS,
      '>=': TokenType.GREATER_EQUAL,
      '<=': TokenType.LESS_EQUAL,
      '&&': TokenType.AND,
      '||': TokenType.OR
    }
    return operators[twoChar] || null
  }

  /**
   * Attempts to read a single-character token
   */
  private tryReadSingleCharToken(char: string): Omit<Token, 'position'> | null {
    const tokenType = this.getSingleCharTokenType(char)
    if (tokenType) {
      this.position++
      return { type: tokenType, value: char }
    }
    return null
  }

  /**
   * Maps single characters to their token types
   */
  private getSingleCharTokenType(char: string): TokenType | null {
    const tokens: Record<string, TokenType> = {
      '(': TokenType.LPAREN,
      ')': TokenType.RPAREN,
      '.': TokenType.DOT,
      ',': TokenType.COMMA,
      '>': TokenType.GREATER_THAN,
      '<': TokenType.LESS_THAN
    }
    return tokens[char] || null
  }

  /**
   * Classifies an identifier as a keyword.
   */
  private classifyIdentifier(identifier: string): TokenType {
    const keywords: Record<string, TokenType> = {
      'true': TokenType.BOOLEAN,
      'false': TokenType.BOOLEAN,
      'null': TokenType.NULL,
      'contains': TokenType.CONTAINS,
      'startsWith': TokenType.STARTS_WITH
    }
    return keywords[identifier] || TokenType.IDENTIFIER
  }

  /**
   * Reads a string literal, handling escape sequences
   */
  private readStringLiteral(): string {
    this.position++ // Skip opening quote
    let value = ''

    while (this.position < this.input.length && this.currentChar() !== '"') {
      if (this.currentChar() === '\\' && this.position + 1 < this.input.length) {
        this.position++
        value += this.readEscapeSequence(this.currentChar())
      } else {
        value += this.currentChar()
      }
      this.position++
    }

    if (this.position >= this.input.length) {
      throw new CelParseError('Unterminated string literal', this.position - value.length - 1)
    }

    this.position++ // Skip closing quote
    return value
  }

  /**
   * Converts escape sequences to their actual characters
   */
  private readEscapeSequence(char: string): string {
    const escapeChars: Record<string, string> = {
      'n': '\n',
      't': '\t',
      'r': '\r',
      '\\': '\\',
      '"': '"'
    }
    return escapeChars[char] || char
  }

  /**
   * Reads a numeric literal (integer or float)
   */
  private readNumber(): string {
    let value = ''
    let hasDecimal = false

    while (this.position < this.input.length) {
      const char = this.currentChar()
      if (this.isDigit(char)) {
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

  /**
   * Reads an identifier (variable name, function name, etc.)
   */
  private readIdentifier(): string {
    let value = ''

    while (this.position < this.input.length && this.isIdentifierChar(this.currentChar())) {
      value += this.currentChar()
      this.position++
    }

    return value
  }

  /**
   * Gets the current character without advancing position
   */
  private currentChar(): string {
    return this.input[this.position]
  }

  /**
   * Checks if a character is a digit
   */
  private isDigit(char: string): boolean {
    return /\d/.test(char)
  }

  /**
   * Checks if a character can start an identifier
   */
  private isIdentifierStart(char: string): boolean {
    return /[a-zA-Z_]/.test(char)
  }

  /**
   * Checks if a character can be part of an identifier
   */
  private isIdentifierChar(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char)
  }
}