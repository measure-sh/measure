package sh.measure.android.cel

/**
 * Abstract syntax tree (AST) representation of CEL expressions.
 * Provides a type-safe hierarchy for all supported CEL expression types.
 */
sealed class CelExpression {

    /**
     * A literal value expression containing constants like strings, numbers, booleans, or null.
     * Examples: "hello", 42, true, null
     */
    data class Literal(val value: CelValue) : CelExpression()

    /**
     * Field access expression for navigating object properties using dot notation.
     * The path represents the chain of field names to traverse.
     * Examples: event.type, user.attributes.session_id
     */
    data class FieldAccess(val path: List<String>) : CelExpression()

    /**
     * Binary operation expression for comparisons, arithmetic, and string operations.
     * Supports equality, relational, string matching, and arithmetic operators.
     * Examples: x == 5, name.contains("test"), age > 21
     */
    data class BinaryOp(val left: CelExpression, val operator: Operator, val right: CelExpression) : CelExpression()

    /**
     * Logical operation expression for boolean AND and OR operations.
     * Combines multiple boolean expressions with short-circuit evaluation.
     * Examples: x > 0 && y < 10, isActive || isTest
     */
    data class LogicalOp(val left: CelExpression, val operator: LogicalOperator, val right: CelExpression) : CelExpression()

    /**
     * Binary and arithmetic operators supported in CEL expressions.
     */
    enum class Operator {
        /** Equality comparison '==' */
        EQUALS,
        /** Inequality comparison '!=' */
        NOT_EQUALS,
        /** Greater than comparison '>' */
        GREATER_THAN,
        /** Less than comparison '<' */
        LESS_THAN,
        /** Greater than or equal comparison '>=' */
        GREATER_EQUAL,
        /** Less than or equal comparison '<=' */
        LESS_EQUAL,
        /** String contains check 'contains' */
        CONTAINS,
        /** String starts with check 'startsWith' */
        STARTS_WITH,
        /** String ends with check 'endsWith' */
        ENDS_WITH,
    }

    /**
     * Logical operators for combining boolean expressions.
     */
    enum class LogicalOperator {
        /** Logical AND '&&' with short-circuit evaluation */
        AND,
        /** Logical OR '||' with short-circuit evaluation */
        OR
    }
}