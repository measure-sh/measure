package sh.measure.android.cel

import sh.measure.android.attributes.BooleanAttr
import sh.measure.android.attributes.DoubleAttr
import sh.measure.android.attributes.FloatAttr
import sh.measure.android.attributes.IntAttr
import sh.measure.android.attributes.LongAttr
import sh.measure.android.attributes.StringAttr
import sh.measure.android.events.Event

/**
 * Evaluates a parsed CEL Abstract Syntax Tree (AST) against a data context.
 *
 * This class takes a parsed [CelExpression] and an event object, executing the expression's
 * logic to produce a final boolean result.
 */
internal class CelEvaluator {
    val parser = CelParser()

    /**
     * The main public entry point for evaluating a CEL expression.
     *
     * This function orchestrates the entire process by first parsing the raw expression
     * string into an AST and then evaluating that tree against the provided event context.
     *
     * @param expression The raw CEL expression string to evaluate.
     * @param event The object or against which the expression is evaluated.
     * @return The final `Boolean` result of the evaluation.
     */
    fun evaluate(expression: String, event: Event<*>): Boolean {
        val parsedExpression = parser.parse(expression)
        val result = evaluateExpression(parsedExpression, event)
        return result.toBoolean()
    }

    /**
     * The core recursive evaluation function that traverses the AST.
     *
     * It uses a `when` statement to delegate the evaluation to a specific handler
     * based on the type of the current [CelExpression] node.
     *
     * @param expression The AST node to evaluate.
     * @param event The event for the evaluation.
     * @return A typed [CelValue] representing the result of the sub-expression.
     */
    private fun evaluateExpression(expression: CelExpression, event: Event<*>): CelValue {
        return when (expression) {
            is CelExpression.Literal -> expression.value
            is CelExpression.FieldAccess -> evaluateFieldAccess(expression.path, event)
            is CelExpression.BinaryOp -> evaluateBinaryOp(expression, event)
            is CelExpression.LogicalOp -> evaluateLogicalOp(expression, event)
        }
    }

    /**
     * Resolves a value by traversing a path of field names, starting from an Event object.
     *
     * This function is designed to handle chained access like `data.user.name` or `attributes.some_key`.
     *
     * @param path The list of strings representing the nested field path.
     * @param event The starting Event object for the traversal.
     * @return The raw resolved value (`Any?`). Returns `null` if any part of the path is null.
     */
    private fun evaluateFieldAccess(path: List<String>, event: Event<*>): CelValue {
        var current: Any? = event
        for (fieldName in path) {
            current = when (current) {
                null -> return CelValue.Null
                is Map<*, *> -> current[fieldName]
                is CelFieldAccessor -> current.getField(fieldName)
                else -> throw IllegalArgumentException("Cannot access field '$fieldName' on ${current::class.simpleName}")
            }
        }
        return convertToValue(current)
    }

    /**
     * Converts a native Kotlin type into its corresponding [CelValue] representation.
     *2
     * @param value The native Kotlin value (`String`, `Number` or `Boolean`) to convert.
     * @return The corresponding [CelValue] wrapper.
     */
    private fun convertToValue(value: Any?): CelValue {
        return when (value) {
            null -> CelValue.Null
            is Boolean -> CelValue.Boolean(value)
            is String -> CelValue.String(value)
            is Number -> CelValue.Number(value.toDouble())
            is StringAttr -> CelValue.String(value.value)
            is BooleanAttr -> CelValue.Boolean(value.value)
            is IntAttr -> CelValue.Number(value.value.toDouble())
            is LongAttr -> CelValue.Number(value.value.toDouble())
            is DoubleAttr -> CelValue.Number(value.value)
            is FloatAttr -> CelValue.Number(value.value.toDouble())
            else -> {
                throw IllegalArgumentException("Unsupported value type: ${value::class.simpleName}")
            }
        }
    }

    /**
     * Evaluates binary operations like `==`, `>`, `contains`, etc.
     *
     * It recursively evaluates the left and right operands first, then applies the operator.
     *
     * @param expression The [CelExpression.BinaryOp] node containing the operands and operator.
     * @param event The event for evaluation.
     * @return The [CelValue.Boolean] result of the operation.
     */
    private fun evaluateBinaryOp(expression: CelExpression.BinaryOp, event: Event<*>): CelValue {
        val left = evaluateExpression(expression.left, event)
        val right = evaluateExpression(expression.right, event)

        return when (expression.operator) {
            CelExpression.Operator.EQUALS -> CelValue.Boolean(compareValues(left, right) == 0)
            CelExpression.Operator.NOT_EQUALS -> CelValue.Boolean(compareValues(left, right) != 0)
            CelExpression.Operator.GREATER_THAN -> CelValue.Boolean(compareValues(left, right) > 0)
            CelExpression.Operator.LESS_THAN -> CelValue.Boolean(compareValues(left, right) < 0)
            CelExpression.Operator.GREATER_EQUAL -> CelValue.Boolean(
                compareValues(
                    left,
                    right
                ) >= 0
            )

            CelExpression.Operator.LESS_EQUAL -> CelValue.Boolean(compareValues(left, right) <= 0)
            CelExpression.Operator.CONTAINS -> {
                when (left) {
                    is CelValue.String -> {
                        val rightStr = when (right) {
                            is CelValue.String -> right.value
                            else -> right.toString()
                        }
                        CelValue.Boolean(left.value.contains(rightStr))
                    }

                    else -> throw IllegalArgumentException("Contains operation requires string on left side")
                }
            }

            CelExpression.Operator.STARTS_WITH -> {
                when (left) {
                    is CelValue.String -> {
                        val rightStr = when (right) {
                            is CelValue.String -> right.value
                            else -> right.toString()
                        }
                        CelValue.Boolean(left.value.startsWith(rightStr))
                    }

                    else -> throw IllegalArgumentException("StartsWith operation requires string on left side")
                }
            }

            CelExpression.Operator.ENDS_WITH -> {
                when (left) {
                    is CelValue.String -> {
                        val rightStr = when (right) {
                            is CelValue.String -> right.value
                            else -> right.toString()
                        }
                        CelValue.Boolean(left.value.endsWith(rightStr))
                    }

                    else -> throw IllegalArgumentException("EndsWith operation requires string on left side")
                }
            }
        }
    }

    /**
     * Evaluates logical AND (`&&`) and OR (`||`) operations.
     *
     * This function correctly implements **short-circuit evaluation**:
     * - For `&&`, if the left side is false, the right side is not evaluated.
     * - For `||`, if the left side is true, the right side is not evaluated.
     *
     * @param expression The [CelExpression.LogicalOp] node.
     * @param event The event for evaluation.
     * @return The [CelValue.Boolean] result of the logical operation.
     */
    private fun evaluateLogicalOp(expression: CelExpression.LogicalOp, event: Event<*>): CelValue {
        val left = evaluateExpression(expression.left, event)

        return when (expression.operator) {
            CelExpression.LogicalOperator.AND -> {
                if (!left.toBoolean()) {
                    CelValue.Boolean(false)
                } else {
                    val right = evaluateExpression(expression.right, event)
                    CelValue.Boolean(right.toBoolean())
                }
            }

            CelExpression.LogicalOperator.OR -> {
                if (left.toBoolean()) {
                    CelValue.Boolean(true)
                } else {
                    val right = evaluateExpression(expression.right, event)
                    CelValue.Boolean(right.toBoolean())
                }
            }
        }
    }

    /**
     * Compares two [CelValue] instances for relational operations (`>`, `<`, etc.).
     *
     * It handles comparisons across different types like numbers, strings, and booleans.
     *
     * @param left The left-hand operand.
     * @param right The right-hand operand.
     * @return An `Int` that follows the standard `compareTo` contract (negative if left < right,
     * zero if left == right, positive if left > right).
     */
    private fun compareValues(left: CelValue, right: CelValue): Int {
        return when {
            left is CelValue.Number && right is CelValue.Number -> left.value.compareTo(right.value)
            left is CelValue.String && right is CelValue.String -> left.value.compareTo(right.value)
            left is CelValue.Boolean && right is CelValue.Boolean -> left.value.compareTo(right.value)
            left is CelValue.Timestamp && right is CelValue.Timestamp -> left.value.compareTo(right.value)
            left is CelValue.Duration && right is CelValue.Duration -> left.value.compareTo(right.value)
            left is CelValue.Null && right is CelValue.Null -> 0
            left is CelValue.Null || right is CelValue.Null -> {
                if (left is CelValue.Null) -1 else 1
            }

            else -> left.toString().compareTo(right.toString())
        }
    }
}