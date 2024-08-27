package sh.measure.android.attributes

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.NoopLogger

// This test uses a real instance of database and hence runs using Robolectric.
@RunWith(AndroidJUnit4::class)
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
        configProvider.maxUserDefinedAttributeKeyLength = 3
        userDefinedAttribute.put("key", "value1")
        userDefinedAttribute.put("longer-length-key", "value2")

        assertEquals(1, userDefinedAttribute.getAll().size)
    }

    @Test
    fun `discards attribute if value length is more than configured maximum length`() {
        configProvider.maxUserDefinedAttributeValueLength = 5
        userDefinedAttribute.put("key1", "value")
        userDefinedAttribute.put("key2", "longer-length-value")

        assertEquals(1, userDefinedAttribute.getAll().size)
    }

    @Test
    fun `discards attribute if key contains spaces by default`() {
        userDefinedAttribute.put("key1", "value1")
        userDefinedAttribute.put("key with spaces", "value2")

        assertEquals(1, userDefinedAttribute.getAll().size)
    }
}
