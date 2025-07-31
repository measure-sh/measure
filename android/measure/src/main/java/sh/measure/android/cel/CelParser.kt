package sh.measure.android.cel

/**
 * Top down parser (specifically Recursive descent parser) for CEL expressions that transforms
 * tokens into an abstract syntax tree. Uses operator precedence to correctly parse complex
 * expressions with proper associativity.
 *
 * Precedence hierarchy (highest to lowest):
 * 1. Primary expressions (literals, parentheses, field access)
 * 2. Comparison operations (==, !=, <, >, <=, >=, contains, startsWith, endsWith)
 * 3. Logical AND (&&)
 * 4. Logical OR (||)
 */
class CelParser {
    private val tokenizer = CelTokenizer()

    /**
     * Parses a CEL expression string into an abstract syntax tree.
     *
     * This is the main entry point that orchestrates tokenization followed by
     * top down parsing starting from the lowest precedence level.
     *
     * @param expression The CEL expression string to parse
     * @return The root expression node representing the entire parsed expression
     * @throws IllegalArgumentException if the expression contains syntax errors
     */
    fun parse(expression: String): CelExpression {
        val tokens = tokenizer.tokenize(expression)
        val (result, finalIndex) = parseOrExpression(tokens, 0)

        // Ensure we've consumed all tokens except EOF
        if (finalIndex < tokens.size - 1) {
            val unexpectedToken = tokens[finalIndex]
            throw IllegalArgumentException(
                "Unexpected token '${unexpectedToken.value}' at position ${unexpectedToken.position}"
            )
        }

        return result
    }

    /**
     * Parses logical OR expressions with lowest precedence in the operator hierarchy.
     *
     * Left-associative parsing creates a left-leaning tree for chains like 'a || b || c',
     * which evaluates as '(a || b) || c'. This matches the expected short-circuit
     * evaluation semantics where evaluation stops at the first true operand.
     */
    private fun parseOrExpression(tokens: List<CelTokenizer.Token>, startIndex: Int): ParseResult {
        var (left, index) = parseAndExpression(tokens, startIndex)

        while (index < tokens.size && tokens[index].type == CelTokenizer.TokenType.OR) {
            index++ // consume OR
            val (right, newIndex) = parseAndExpression(tokens, index)
            left = CelExpression.LogicalOp(left, CelExpression.LogicalOperator.OR, right)
            index = newIndex
        }

        return ParseResult(left, index)
    }

    /**
     * Parses logical AND expressions with higher precedence than OR operations.
     *
     * Follows precedence rules where AND binds tighter than OR, enabling natural
     * expression evaluation like 'a || b && c' parsing as 'a || (b && c)'.
     * Left-associative for consistent evaluation order in chains.
     */
    private fun parseAndExpression(tokens: List<CelTokenizer.Token>, startIndex: Int): ParseResult {
        var (left, index) = parseComparisonExpression(tokens, startIndex)

        while (index < tokens.size && tokens[index].type == CelTokenizer.TokenType.AND) {
            index++ // consume AND
            val (right, newIndex) = parseComparisonExpression(tokens, index)
            left = CelExpression.LogicalOp(left, CelExpression.LogicalOperator.AND, right)
            index = newIndex
        }

        return ParseResult(left, index)
    }

    /**
     * Parses comparison and string operations with higher precedence than logical operators.
     *
     * Handles equality, relational, and string matching operations as non-associative
     * binary expressions. Single comparison per expression level prevents ambiguous
     * chains like 'a < b < c' which would require clarification as '(a < b) && (b < c)'.
     */
    private fun parseComparisonExpression(tokens: List<CelTokenizer.Token>, startIndex: Int): ParseResult {
        val (left, index) = parsePrimaryExpression(tokens, startIndex)

        if (index < tokens.size) {
            val operator = when (tokens[index].type) {
                CelTokenizer.TokenType.EQUALS -> CelExpression.Operator.EQUALS
                CelTokenizer.TokenType.NOT_EQUALS -> CelExpression.Operator.NOT_EQUALS
                CelTokenizer.TokenType.GREATER_THAN -> CelExpression.Operator.GREATER_THAN
                CelTokenizer.TokenType.LESS_THAN -> CelExpression.Operator.LESS_THAN
                CelTokenizer.TokenType.GREATER_EQUAL -> CelExpression.Operator.GREATER_EQUAL
                CelTokenizer.TokenType.LESS_EQUAL -> CelExpression.Operator.LESS_EQUAL
                CelTokenizer.TokenType.CONTAINS -> CelExpression.Operator.CONTAINS
                CelTokenizer.TokenType.STARTS_WITH -> CelExpression.Operator.STARTS_WITH
                CelTokenizer.TokenType.ENDS_WITH -> CelExpression.Operator.ENDS_WITH
                else -> return ParseResult(left, index)
            }

            val (right, newIndex) = parsePrimaryExpression(tokens, index + 1)
            return ParseResult(CelExpression.BinaryOp(left, operator, right), newIndex)
        }

        return ParseResult(left, index)
    }

    /**
     * Parses atomic expressions and complex primary constructs with highest precedence.
     *
     * Handles literals, parenthesized expressions, field access chains, function calls,
     * and method invocations. The decision tree distinguishes between:
     * - Standalone identifiers and field access patterns
     * - Function calls (identifier followed by parentheses)
     * - Method calls (transformed into binary operations for consistent semantics)
     *
     * Method calls like 'field.contains(value)' are transformed into binary operations
     * to maintain consistent evaluation semantics across the expression tree.
     */
    private fun parsePrimaryExpression(tokens: List<CelTokenizer.Token>, startIndex: Int): ParseResult {
        val index = startIndex

        if (index >= tokens.size) {
            throw IllegalArgumentException("Unexpected end of expression")
        }

        return when (tokens[index].type) {
            CelTokenizer.TokenType.LPAREN -> parseParenthesizedExpression(tokens, index)
            CelTokenizer.TokenType.STRING -> parseLiteral(tokens, index) { CelValue.String(it) }
            CelTokenizer.TokenType.NUMBER -> parseLiteral(tokens, index) { CelValue.Number(it.toDouble()) }
            CelTokenizer.TokenType.BOOLEAN -> parseLiteral(tokens, index) { CelValue.Boolean(it.toBoolean()) }
            CelTokenizer.TokenType.NULL -> ParseResult(CelExpression.Literal(CelValue.Null), index + 1)
            CelTokenizer.TokenType.IDENTIFIER -> parseIdentifierExpression(tokens, index)
            else -> throw IllegalArgumentException("Unexpected token: ${tokens[index].value} at position ${tokens[index].position}")
        }
    }

    /**
     * Parses expressions enclosed in parentheses for precedence override.
     */
    private fun parseParenthesizedExpression(tokens: List<CelTokenizer.Token>, startIndex: Int): ParseResult {
        var index = startIndex + 1 // consume (
        val (expr, newIndex) = parseOrExpression(tokens, index)
        index = newIndex

        if (index >= tokens.size || tokens[index].type != CelTokenizer.TokenType.RPAREN) {
            throw IllegalArgumentException("Missing closing parenthesis")
        }

        return ParseResult(expr, index + 1) // consume )
    }

    /**
     * Parses literal values into expression nodes.
     */
    private fun parseLiteral(
        tokens: List<CelTokenizer.Token>,
        index: Int,
        valueConstructor: (String) -> CelValue
    ): ParseResult {
        val value = valueConstructor(tokens[index].value)
        return ParseResult(CelExpression.Literal(value), index + 1)
    }

    /**
     * Parses identifier-based expressions including field access, function calls, and method calls.
     */
    private fun parseIdentifierExpression(tokens: List<CelTokenizer.Token>, startIndex: Int): ParseResult {
        val identifier = tokens[startIndex].value
        var index = startIndex + 1

        // Parse field access chain
        val fieldPath = mutableListOf(identifier)
        while (index < tokens.size && tokens[index].type == CelTokenizer.TokenType.DOT) {
            index++ // consume .

            if (index >= tokens.size || tokens[index].type != CelTokenizer.TokenType.IDENTIFIER) {
                // Check for method calls
                return parseMethodCall(fieldPath, tokens, index)
            }

            fieldPath.add(tokens[index].value)
            index++
        }

        return ParseResult(CelExpression.FieldAccess(fieldPath), index)
    }

    /**
     * Parses method calls on field access expressions.
     * Transforms method syntax into binary operations for consistent evaluation.
     */
    private fun parseMethodCall(fieldPath: List<String>, tokens: List<CelTokenizer.Token>, index: Int): ParseResult {
        if (index >= tokens.size) {
            return ParseResult(CelExpression.FieldAccess(fieldPath), index)
        }

        val methodToken = tokens[index]
        val operator = when (methodToken.type) {
            CelTokenizer.TokenType.CONTAINS -> CelExpression.Operator.CONTAINS
            CelTokenizer.TokenType.STARTS_WITH -> CelExpression.Operator.STARTS_WITH
            CelTokenizer.TokenType.ENDS_WITH -> CelExpression.Operator.ENDS_WITH
            else -> return ParseResult(CelExpression.FieldAccess(fieldPath), index)
        }

        var newIndex = index + 1 // consume method name

        if (newIndex >= tokens.size || tokens[newIndex].type != CelTokenizer.TokenType.LPAREN) {
            throw IllegalArgumentException("Expected '(' after method name at position ${methodToken.position}")
        }

        newIndex++ // consume (
        val (arg, argIndex) = parseOrExpression(tokens, newIndex)
        newIndex = argIndex

        if (newIndex >= tokens.size || tokens[newIndex].type != CelTokenizer.TokenType.RPAREN) {
            throw IllegalArgumentException("Missing closing parenthesis in method call")
        }

        newIndex++ // consume )

        return ParseResult(
            CelExpression.BinaryOp(CelExpression.FieldAccess(fieldPath), operator, arg),
            newIndex
        )
    }

    /**
     * Data class representing parsing results with both the expression and next token position.
     * Enables continuation of parsing while maintaining immutability.
     */
    private data class ParseResult(val expression: CelExpression, val nextIndex: Int)
}