package sh.measure.kmp.attributes

import kotlin.test.Test
import kotlin.test.assertIs
import sh.measure.android.attributes.BooleanAttr as AndroidBooleanAttr
import sh.measure.android.attributes.DoubleAttr as AndroidDoubleAttr
import sh.measure.android.attributes.FloatAttr as AndroidFloatAttr
import sh.measure.android.attributes.IntAttr as AndroidIntAttr
import sh.measure.android.attributes.LongAttr as AndroidLongAttr
import sh.measure.android.attributes.StringAttr as AndroidStringAttr

class AttributeConvertersTest {

    @Test
    fun `StringAttr converts to AndroidStringAttr`() {
        assertIs<AndroidStringAttr>(StringAttr("value").toAndroid())
    }

    @Test
    fun `BooleanAttr converts to AndroidBooleanAttr`() {
        assertIs<AndroidBooleanAttr>(BooleanAttr(true).toAndroid())
    }

    @Test
    fun `IntAttr converts to AndroidIntAttr`() {
        assertIs<AndroidIntAttr>(IntAttr(42).toAndroid())
    }

    @Test
    fun `LongAttr converts to AndroidLongAttr`() {
        assertIs<AndroidLongAttr>(LongAttr(42L).toAndroid())
    }

    @Test
    fun `FloatAttr converts to AndroidFloatAttr`() {
        assertIs<AndroidFloatAttr>(FloatAttr(1.5f).toAndroid())
    }

    @Test
    fun `DoubleAttr converts to AndroidDoubleAttr`() {
        assertIs<AndroidDoubleAttr>(DoubleAttr(1.5).toAndroid())
    }

    @Test
    fun `map converts all values to Android types`() {
        val map = mapOf<String, AttributeValue>(
            "string" to StringAttr("value"),
            "bool" to BooleanAttr(true),
        )
        val result = map.toAndroid()
        assertIs<AndroidStringAttr>(result["string"])
        assertIs<AndroidBooleanAttr>(result["bool"])
    }
}
