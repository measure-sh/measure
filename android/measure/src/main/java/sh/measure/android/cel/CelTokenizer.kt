package sh.measure.android.cel

/**
 * Lexical analyzer for CEL expressions that converts raw text into a stream of meaningful tokens.
 * Handles operators, literals, identifiers, and punctuation while preserving source positions
 * for accurate error reporting.
 */
class CelTokenizer {

    /**
     * Token representation containing type information, textual value, and source position.
     * Position tracking enables precise error reporting during parsing and evaluation.
     */
    data class Token(
        val type: TokenType,
        val value: String,
        val position: Int,
    )

    /**
     * Enumeration of all supported token types in CEL expressions.
     * Organized by category: literals, operators, punctuation, and special markers.
     */
    enum class TokenType {
        // Literals
        IDENTIFIER,      // Field names, function names, variables
        STRING,          // String literals in double quotes
        NUMBER,          // Numeric literals (integers and decimals)
        BOOLEAN,         // Boolean literals 'true' and 'false'
        NULL,            // Null literal

        // Comparison operators
        EQUALS,          // ==
        NOT_EQUALS,      // !=
        GREATER_THAN,    // >
        LESS_THAN,       // <
        GREATER_EQUAL,   // >=
        LESS_EQUAL,      // <=

        // String operations
        CONTAINS,        // contains
        STARTS_WITH,     // startsWith
        ENDS_WITH,       // endsWith

        // Logical operators
        AND,             // &&
        OR,              // ||

        // Punctuation
        DOT,             // .
        LPAREN,          // (
        RPAREN,          // )
        COMMA,           // ,

        // Special
        EOF              // End of file marker
    }

    /**
     * Tokenizes a CEL expression string into a list of tokens.
     *
     * Performs lexical analysis by scanning the input character by character,
     * recognizing patterns for different token types. Multi-character operators
     * are detected before single-character ones to avoid ambiguous tokenization.
     *
     * @param expression The CEL expression string to tokenize
     * @return List of tokens representing the lexical structure
     * @throws IllegalArgumentException if an unexpected character is encountered
     */
    fun tokenize(expression: String): List<Token> {
        val tokens = mutableListOf<Token>()
        var i = 0

        while (i < expression.length) {
            when {
                expression[i].isWhitespace() -> {
                    i++
                }

                // Single character tokens
                expression[i] == '(' -> {
                    tokens.add(Token(TokenType.LPAREN, "(", i))
                    i++
                }

                expression[i] == ')' -> {
                    tokens.add(Token(TokenType.RPAREN, ")", i))
                    i++
                }

                expression[i] == '.' -> {
                    tokens.add(Token(TokenType.DOT, ".", i))
                    i++
                }

                expression[i] == ',' -> {
                    tokens.add(Token(TokenType.COMMA, ",", i))
                    i++
                }

                // String literals
                expression[i] == '"' -> {
                    val start = i
                    i++ // skip opening quote
                    while (i < expression.length && expression[i] != '"') {
                        i++
                    }
                    if (i >= expression.length) {
                        throw IllegalArgumentException("Unterminated string literal starting at position $start")
                    }
                    i++ // skip closing quote
                    tokens.add(
                        Token(
                            TokenType.STRING,
                            expression.substring(start + 1, i - 1),
                            start
                        )
                    )
                }

                // Numbers
                expression[i].isDigit() -> {
                    val start = i
                    while (i < expression.length && (expression[i].isDigit() || expression[i] == '.')) {
                        i++
                    }
                    tokens.add(Token(TokenType.NUMBER, expression.substring(start, i), start))
                }

                // Identifiers and keywords
                expression[i].isLetter() || expression[i] == '_' -> {
                    val start = i
                    while (i < expression.length && (expression[i].isLetterOrDigit() || expression[i] == '_')) {
                        i++
                    }
                    val value = expression.substring(start, i)
                    val type = determineKeywordType(value)
                    tokens.add(Token(type, value, start))
                }

                // Multi-character operators (must be checked before single-character ones)
                expression.startsWith("==", i) -> {
                    tokens.add(Token(TokenType.EQUALS, "==", i))
                    i += 2
                }

                expression.startsWith("!=", i) -> {
                    tokens.add(Token(TokenType.NOT_EQUALS, "!=", i))
                    i += 2
                }

                expression.startsWith(">=", i) -> {
                    tokens.add(Token(TokenType.GREATER_EQUAL, ">=", i))
                    i += 2
                }

                expression.startsWith("<=", i) -> {
                    tokens.add(Token(TokenType.LESS_EQUAL, "<=", i))
                    i += 2
                }

                expression.startsWith("&&", i) -> {
                    tokens.add(Token(TokenType.AND, "&&", i))
                    i += 2
                }

                expression.startsWith("||", i) -> {
                    tokens.add(Token(TokenType.OR, "||", i))
                    i += 2
                }

                // Single-character comparison operators
                expression[i] == '>' -> {
                    tokens.add(Token(TokenType.GREATER_THAN, ">", i))
                    i++
                }

                expression[i] == '<' -> {
                    tokens.add(Token(TokenType.LESS_THAN, "<", i))
                    i++
                }

                else -> {
                    throw IllegalArgumentException("Unexpected character: '${expression[i]}' at position $i")
                }
            }
        }

        tokens.add(Token(TokenType.EOF, "", expression.length))
        return tokens
    }

    /**
     * Determines the appropriate token type for identifier-like strings.
     * Recognizes reserved keywords and special identifiers, classifying them
     * into their appropriate token types rather than generic identifiers.
     */
    private fun determineKeywordType(value: String): TokenType = when (value) {
        "true", "false" -> TokenType.BOOLEAN
        "null", "NULL" -> TokenType.NULL
        "contains" -> TokenType.CONTAINS
        "startsWith" -> TokenType.STARTS_WITH
        "endsWith" -> TokenType.ENDS_WITH
        else -> TokenType.IDENTIFIER
    }
}