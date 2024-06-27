package sh.measure.android.attributes

import org.junit.Assert.assertEquals
import org.junit.Test
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.NoopLogger

class UserDefinedAttributeTest {
    private val logger = NoopLogger()
    private val configProvider = FakeConfigProvider()
    private val userDefinedAttribute = UserDefinedAttributeImpl(logger, configProvider)

    @Test
    fun `sets new attributes`() {
        userDefinedAttribute.put("key1", "value1")
        userDefinedAttribute.put("key2", "value2")
        userDefinedAttribute.put("key3", "value3")

        assertEquals(3, userDefinedAttribute.getAll().size)
    }

    @Test
    fun `updates attribute if same key is set with a new value`() {
        userDefinedAttribute.put("key1", "value1.0")
        userDefinedAttribute.put("key1", "value1.1")

        val attributes = userDefinedAttribute.getAll()
        assertEquals(1, attributes.size)
        assertEquals("value1.1", attributes["key1"])
    }

    @Test
    fun `clears all attributes`() {
        userDefinedAttribute.put("key1", "value1")
        userDefinedAttribute.put("key2", "value2")
        userDefinedAttribute.put("key3", "value3")
        assertEquals(3, userDefinedAttribute.getAll().size)

        userDefinedAttribute.clear()
        assertEquals(0, userDefinedAttribute.getAll().size)
    }

    @Test
    fun `removes a attribute with the given key`() {
        userDefinedAttribute.put("key1", "value1")
        userDefinedAttribute.put("key2", "value2")
        userDefinedAttribute.put("key3", "value3")
        assertEquals(3, userDefinedAttribute.getAll().size)

        userDefinedAttribute.remove("key1")
        assertEquals(2, userDefinedAttribute.getAll().size)
    }

    @Test
    fun `discards attribute if key length is more than configured maximum length`() {
        configProvider.defaultMaxUserDefinedAttributeKeyLength = 3
        userDefinedAttribute.put("key", "value1")
        userDefinedAttribute.put("longer-length-key", "value2")

        assertEquals(1, userDefinedAttribute.getAll().size)
    }

    @Test
    fun `discards attribute if value length is more than configured maximum length`() {
        configProvider.defaultMaxUserDefinedAttributeValueLength = 5
        userDefinedAttribute.put("key1", "value")
        userDefinedAttribute.put("key2", "longer-length-value")

        assertEquals(1, userDefinedAttribute.getAll().size)
    }

    @Test
    fun `discards attribute if key contains spaces`() {
        configProvider.defaultUserDefinedAttributeKeyWithSpaces = false
        userDefinedAttribute.put("key1", "value1")
        userDefinedAttribute.put("key with spaces", "value2")

        assertEquals(1, userDefinedAttribute.getAll().size)
    }

    @Test
    fun `does not throw event if data type of a key is changed`() {
        userDefinedAttribute.put("key1", "value1")
        userDefinedAttribute.put("key1", 123)

        val attributes = userDefinedAttribute.getAll()
        assertEquals(1, attributes.size)
        assertEquals(123, attributes["key1"])
    }
}