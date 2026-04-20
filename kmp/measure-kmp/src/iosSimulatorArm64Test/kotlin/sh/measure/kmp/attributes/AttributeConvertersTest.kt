package sh.measure.kmp.attributes

import kotlin.test.Test
import kotlin.test.assertEquals

class AttributeConvertersTest {

    @Test
    fun `StringAttr converts to String`() {
        assertEquals("value", StringAttr("value").toNative())
    }

    @Test
    fun `BooleanAttr converts to Boolean`() {
        assertEquals(true, BooleanAttr(true).toNative())
    }

    @Test
    fun `IntAttr converts to Int`() {
        assertEquals(42, IntAttr(42).toNative())
    }

    @Test
    fun `LongAttr converts to Long`() {
        assertEquals(42L, LongAttr(42L).toNative())
    }

    @Test
    fun `FloatAttr converts to Float`() {
        assertEquals(1.5f, FloatAttr(1.5f).toNative())
    }

    @Test
    fun `DoubleAttr converts to Double`() {
        assertEquals(1.5, DoubleAttr(1.5).toNative())
    }

    @Test
    fun `map converts all values to native types`() {
        val map = mapOf<String, AttributeValue>(
            "string" to StringAttr("value"),
            "bool" to BooleanAttr(true),
        )
        val result = map.toNative()
        assertEquals("value", result["string"])
        assertEquals(true, result["bool"])
    }
}
