package sh.measure.android.cel

import junit.framework.TestCase.assertEquals
import org.junit.Assert
import org.junit.Test

class CelParserTest {
    private val parser = CelParser()

    @Test
    fun `parse with number literal returns number expression`() {
        val expression = "123"
        val expectedAst = CelExpression.Literal(CelValue.Number(123.0))
        val actualAst = parser.parse(expression)

        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with string literal returns string expression`() {
        val expression = "\"hello\""
        val expectedAst = CelExpression.Literal(CelValue.String("hello"))
        val actualAst = parser.parse(expression)

        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with boolean literal returns boolean expression`() {
        val expression = "true"
        val expectedAst = CelExpression.Literal(CelValue.Boolean(true))
        val actualAst = parser.parse(expression)
        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with null literal returns null expression`() {
        val expression = "null"
        val expectedAst = CelExpression.Literal(CelValue.Null)
        val actualAst = parser.parse(expression)
        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with single identifier returns field access expression`() {
        val expression = "foo"
        val expectedAst = CelExpression.FieldAccess(listOf("foo"))
        val actualAst = parser.parse(expression)
        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with chained field access returns correct field path`() {
        val expression = "foo.bar.baz"
        val expectedAst = CelExpression.FieldAccess(listOf("foo", "bar", "baz"))
        val actualAst = parser.parse(expression)
        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with contains method call returns correct binary op`() {
        val expression = "user.name.contains(searchTerm)"
        val expectedAst = CelExpression.BinaryOp(
            left = CelExpression.FieldAccess(listOf("user", "name")),
            operator = CelExpression.Operator.CONTAINS,
            right = CelExpression.FieldAccess(listOf("searchTerm"))
        )
        val actualAst = parser.parse(expression)

        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with startsWith method call returns correct binary op`() {
        val expression = "user.name.startsWith(prefix)"
        val expectedAst = CelExpression.BinaryOp(
            left = CelExpression.FieldAccess(listOf("user", "name")),
            operator = CelExpression.Operator.STARTS_WITH,
            right = CelExpression.FieldAccess(listOf("prefix"))
        )
        val actualAst = parser.parse(expression)

        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with endsWith method call returns correct binary op`() {
        val expression = "user.name.endsWith(suffix)"
        val expectedAst = CelExpression.BinaryOp(
            left = CelExpression.FieldAccess(listOf("user", "name")),
            operator = CelExpression.Operator.ENDS_WITH,
            right = CelExpression.FieldAccess(listOf("suffix"))
        )
        val actualAst = parser.parse(expression)

        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with and and or honors and precedence over or`() {
        val expression = "a && b || c"
        val expectedAst = CelExpression.LogicalOp(
            left = CelExpression.LogicalOp(
                left = CelExpression.FieldAccess(listOf("a")),
                operator = CelExpression.LogicalOperator.AND,
                right = CelExpression.FieldAccess(listOf("b"))
                ),
            operator = CelExpression.LogicalOperator.OR,
            right = CelExpression.FieldAccess(listOf("c"))
        )
        val actualAst = parser.parse(expression)

        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with comparison and logical ops honors comparison precedence`() {
        val expression = "a < b && c > d"
        val expectedAst = CelExpression.LogicalOp(
            left = CelExpression.BinaryOp(
                left = CelExpression.FieldAccess(listOf("a")),
                operator = CelExpression.Operator.LESS_THAN,
                right = CelExpression.FieldAccess(listOf("b"))
            ),
            operator = CelExpression.LogicalOperator.AND,
            right = CelExpression.BinaryOp(
                left = CelExpression.FieldAccess(listOf("c")),
                operator = CelExpression.Operator.GREATER_THAN,
                right = CelExpression.FieldAccess(listOf("d"))
            )
        )
        val actualAst = parser.parse(expression)

        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with parentheses overrides default precedence`() {
        // Normally '&&' would bind first. Parentheses force '||' to be evaluated first.
        val expression = "a && (b || c)"
        val expectedAst = CelExpression.LogicalOp(
            left = CelExpression.FieldAccess(listOf("a")),
            operator = CelExpression.LogicalOperator.AND,
            right = CelExpression.LogicalOp(
                left = CelExpression.FieldAccess(listOf("b")),
                operator = CelExpression.LogicalOperator.OR,
                right = CelExpression.FieldAccess(listOf("c"))
            )
        )
        val actualAst = parser.parse(expression)

        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with nested parentheses parses correctly`() {
        val expression = "a && (b || (c && d))"
        val expectedAst = CelExpression.LogicalOp(
            left = CelExpression.FieldAccess(listOf("a")),
            operator = CelExpression.LogicalOperator.AND,
            right = CelExpression.LogicalOp(
                left = CelExpression.FieldAccess(listOf("b")),
                operator = CelExpression.LogicalOperator.OR,
                right = CelExpression.LogicalOp(
                    left = CelExpression.FieldAccess(listOf("c")),
                    operator = CelExpression.LogicalOperator.AND,
                    right = CelExpression.FieldAccess(listOf("d"))
                )
            )
        )
        val actualAst = parser.parse(expression)

        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with chained ors is left associative`() {
        val expression = "a || b || c"
        val expectedAst = CelExpression.LogicalOp(
            left = CelExpression.LogicalOp(
                left = CelExpression.FieldAccess(listOf("a")),
                operator = CelExpression.LogicalOperator.OR,
                right = CelExpression.FieldAccess(listOf("b"))
            ),
            operator = CelExpression.LogicalOperator.OR,
            right = CelExpression.FieldAccess(listOf("c"))
        )
        val actualAst = parser.parse(expression)

        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with chained ands is left associative`() {
        val expression = "a && b && c"
        val expectedAst = CelExpression.LogicalOp(
            left = CelExpression.LogicalOp(
                left = CelExpression.FieldAccess(listOf("a")),
                operator = CelExpression.LogicalOperator.AND,
                right = CelExpression.FieldAccess(listOf("b"))
            ),
            operator = CelExpression.LogicalOperator.AND,
            right = CelExpression.FieldAccess(listOf("c"))
        )
        val actualAst = parser.parse(expression)

        assertEquals(expectedAst, actualAst)
    }

    @Test
    fun `parse with trailing unexpected token throws exception`() {
        Assert.assertThrows(IllegalArgumentException::class.java, {
            parser.parse("1 &&")
        })
    }

    @Test
    fun `parse with unmatched opening parenthesis throws exception`() {
        Assert.assertThrows(IllegalArgumentException::class.java, {
            parser.parse("a && b)")
        })
    }

    @Test
    fun `parse with missing closing parenthesis throws exception`() {
        Assert.assertThrows(IllegalArgumentException::class.java, {
            parser.parse("(a && b")
        })
    }

    @Test
    fun `parse with missing right hand operand for binary op throws exception`() {
        Assert.assertThrows(IllegalArgumentException::class.java, {
            parser.parse("a == ")
        })
    }

    @Test
    fun `parse with operator at start of expression throws exception`() {
        Assert.assertThrows(IllegalArgumentException::class.java, {
            parser.parse("&& a")
        })
    }

    @Test
    fun `parse with empty input throws exception`() {
        Assert.assertThrows(IllegalArgumentException::class.java, {
            parser.parse("   ")
        })
    }

    @Test
    fun `parse with missing parenthesis after method name throws exception`() {
        Assert.assertThrows(IllegalArgumentException::class.java, {
            parser.parse("user.contains")
        })
    }

    @Test
    fun `parse with chained comparison operators throws exception`() {
        Assert.assertThrows(IllegalArgumentException::class.java, {
            parser.parse("a < b < c")
        })
    }
}