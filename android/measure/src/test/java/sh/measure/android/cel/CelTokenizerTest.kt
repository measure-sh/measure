package sh.measure.android.cel

import org.junit.Assert
import org.junit.Assert.assertEquals
import org.junit.Test

class CelTokenizerTest {
    private val tokenizer = CelTokenizer()

    /**
     * A helper function to assert the token types from an expression string.
     * It tokenizes the input and compares the resulting token types with the
     * expected types provided as varargs.
     *
     * @param expression The raw string expression to tokenize.
     * @param expected The expected sequence of CelTokenizer.TokenType.
     */
    private fun assertTokenization(expression: String, vararg expected: CelTokenizer.TokenType) {
        val actualTypes = tokenizer.tokenize(expression).map { it.type }
        assertEquals(expected.toList(), actualTypes)
    }

    @Test
    fun `ignores whitespace`() {
        assertTokenization("     ", CelTokenizer.TokenType.EOF)
    }

    @Test
    fun `tokenize parenthesis`() {
        assertTokenization(
            expression = "( )",
            CelTokenizer.TokenType.LPAREN,
            CelTokenizer.TokenType.RPAREN,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize dot`() {
        assertTokenization(
            expression = ".",
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize comma`() {
        assertTokenization(
            expression = ",",
            CelTokenizer.TokenType.COMMA,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize string in quotes`() {
        assertTokenization(
            expression = "\"hello world\"",
            CelTokenizer.TokenType.STRING,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize whole numbers`() {
        assertTokenization(
            expression = "123",
            CelTokenizer.TokenType.NUMBER,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize decimal numbers`() {
        assertTokenization(
            expression = "1.23",
            CelTokenizer.TokenType.NUMBER,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize boolean literals`() {
        assertTokenization(
            expression = "true false",
            CelTokenizer.TokenType.BOOLEAN,
            CelTokenizer.TokenType.BOOLEAN,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize null literals`() {
        assertTokenization(
            expression = "null NULL",
            CelTokenizer.TokenType.NULL,
            CelTokenizer.TokenType.NULL,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize contains function`() {
        assertTokenization(
            expression = "contains _contains",
            CelTokenizer.TokenType.CONTAINS,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize startsWith function`() {
        assertTokenization(
            expression = "startsWith _startsWith",
            CelTokenizer.TokenType.STARTS_WITH,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize endsWith function`() {
        assertTokenization(
            expression = "endsWith _endsWith",
            CelTokenizer.TokenType.ENDS_WITH,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize arithmetic operators`() {
        assertTokenization(
            expression = "== != > >= < <=",
            CelTokenizer.TokenType.EQUALS,
            CelTokenizer.TokenType.NOT_EQUALS,
            CelTokenizer.TokenType.GREATER_THAN,
            CelTokenizer.TokenType.GREATER_EQUAL,
            CelTokenizer.TokenType.LESS_THAN,
            CelTokenizer.TokenType.LESS_EQUAL,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize logical operators`() {
        assertTokenization(
            expression = "&& ||",
            CelTokenizer.TokenType.AND,
            CelTokenizer.TokenType.OR,
            CelTokenizer.TokenType.EOF
        )
    }

    @Test
    fun `tokenize real world expressions`() {
        assertTokenization(
            expression = "type == lifecycle_activity",
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EQUALS,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EOF
        )

        assertTokenization(
            expression = "type == lifecycle_activity && lifecycle_activity.contains(\"MainActivity\")",
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EQUALS,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.AND,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.CONTAINS,
            CelTokenizer.TokenType.LPAREN,
            CelTokenizer.TokenType.STRING,
            CelTokenizer.TokenType.RPAREN,
            CelTokenizer.TokenType.EOF,
        )

        assertTokenization(
            expression = "cpu_usage.percentage_usage > 10.0",
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.GREATER_THAN,
            CelTokenizer.TokenType.NUMBER,
            CelTokenizer.TokenType.EOF
        )

        assertTokenization(
            expression = "user_defined_attribute != null",
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.NOT_EQUALS,
            CelTokenizer.TokenType.NULL,
            CelTokenizer.TokenType.EOF
        )

        assertTokenization(
            expression = "user_defined_attribute.custom_flag == true",
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EQUALS,
            CelTokenizer.TokenType.BOOLEAN,
            CelTokenizer.TokenType.EOF
        )

        assertTokenization(
            expression = """attribute.device_is_foldable == "(a value in brackets with spaces)"""",
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EQUALS,
            CelTokenizer.TokenType.STRING,
            CelTokenizer.TokenType.EOF
        )

        assertTokenization(
            expression = """attribute.device_locale.startsWith("en")""",
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.STARTS_WITH,
            CelTokenizer.TokenType.LPAREN,
            CelTokenizer.TokenType.STRING,
            CelTokenizer.TokenType.RPAREN,
            CelTokenizer.TokenType.EOF,
        )

        assertTokenization(
            expression = """attribute.device_locale.endsWith("en")""",
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.ENDS_WITH,
            CelTokenizer.TokenType.LPAREN,
            CelTokenizer.TokenType.STRING,
            CelTokenizer.TokenType.RPAREN,
            CelTokenizer.TokenType.EOF,
        )

        assertTokenization(
            expression = """attribute.device_low_power_mode == true || attribute.device_thermal_throttling_enabled == true""",
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EQUALS,
            CelTokenizer.TokenType.BOOLEAN,
            CelTokenizer.TokenType.OR,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EQUALS,
            CelTokenizer.TokenType.BOOLEAN,
            CelTokenizer.TokenType.EOF,
        )

        assertTokenization(
            expression = """(attribute.platform == "🚀" || attribute.device_type == "phone@123") && attribute.network_type == "wifi"""",
            CelTokenizer.TokenType.LPAREN,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EQUALS,
            CelTokenizer.TokenType.STRING,
            CelTokenizer.TokenType.OR,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EQUALS,
            CelTokenizer.TokenType.STRING,
            CelTokenizer.TokenType.RPAREN,
            CelTokenizer.TokenType.AND,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.DOT,
            CelTokenizer.TokenType.IDENTIFIER,
            CelTokenizer.TokenType.EQUALS,
            CelTokenizer.TokenType.STRING,
            CelTokenizer.TokenType.EOF,
        )
    }

    @Test
    fun `throws for invalid expression`() {
        Assert.assertThrows(IllegalArgumentException::class.java, {
            tokenizer.tokenize("5 % 2")
        })

        Assert.assertThrows(IllegalArgumentException::class.java, {
            tokenizer.tokenize("5 + 2")
        })

        Assert.assertThrows(IllegalArgumentException::class.java, {
            tokenizer.tokenize("5 - 2")
        })

        Assert.assertThrows(IllegalArgumentException::class.java, {
            tokenizer.tokenize("1 ^ 2")
        })

        Assert.assertThrows(IllegalArgumentException::class.java, {
            tokenizer.tokenize("3 * 4")
        })

        Assert.assertThrows(IllegalArgumentException::class.java, {
            tokenizer.tokenize("test🚀field")
        })

        Assert.assertThrows(IllegalArgumentException::class.java, {
            tokenizer.tokenize("field®name")
        })

        Assert.assertThrows(IllegalArgumentException::class.java, {
            tokenizer.tokenize("'name'")
        })
    }
}