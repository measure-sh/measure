package sh.measure.android.attributes

import androidx.concurrent.futures.ResolvableFuture
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.DatabaseImpl

// This test uses a real instance of database and hence runs using Robolectric.
@RunWith(AndroidJUnit4::class)
class UserDefinedAttributeTest {
    private val logger = NoopLogger()
    private val configProvider = FakeConfigProvider()
    private val database = DatabaseImpl(InstrumentationRegistry.getInstrumentation().context, logger)
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val userDefinedAttribute = UserDefinedAttributeImpl(logger, configProvider, database, executorService)

    @Test
    fun `sets new attributes`() {
        userDefinedAttribute.put("key1", "value1", false)
        userDefinedAttribute.put("key2", "value2", false)
        userDefinedAttribute.put("key3", "value3", false)

        assertEquals(3, userDefinedAttribute.getAll().size)
    }

    @Test
    fun `sets new attributes and stores them to db if store=true`() {
        userDefinedAttribute.put("key1", "value1", true)
        userDefinedAttribute.put("key2", "value2", true)
        userDefinedAttribute.put("key3", "value3", false)

        assertEquals(2, database.getUserDefinedAttributes().size)
        assertEquals(3, userDefinedAttribute.getAll().size)
    }

    @Test
    fun `updates attribute if same key is set with a new value in both memory and database`() {
        userDefinedAttribute.put("key1", "value1.0", true)
        userDefinedAttribute.put("key1", "value1.1", true)

        val attributes = userDefinedAttribute.getAll()
        assertEquals(1, attributes.size)
        assertEquals("value1.1", attributes["key1"])
        assertEquals("value1.1", database.getUserDefinedAttributes()["key1"])
    }

    @Test
    fun `clears all attributes from memory and database`() {
        userDefinedAttribute.put("key1", "value1", true)
        userDefinedAttribute.put("key2", "value2", true)
        userDefinedAttribute.put("key3", "value3", false)
        assertEquals(3, userDefinedAttribute.getAll().size)
        assertEquals(2, database.getUserDefinedAttributes().size)

        userDefinedAttribute.clear()
        assertEquals(0, userDefinedAttribute.getAll().size)
        assertEquals(0, database.getUserDefinedAttributes().size)
    }

    @Test
    fun `removes a attribute with the given key from memory and database`() {
        userDefinedAttribute.put("key1", "value1", true)
        userDefinedAttribute.put("key2", "value2", true)
        userDefinedAttribute.put("key3", "value3", false)
        assertEquals(3, userDefinedAttribute.getAll().size)
        assertEquals(2, database.getUserDefinedAttributes().size)

        userDefinedAttribute.remove("key1")
        assertEquals(2, userDefinedAttribute.getAll().size)
        assertEquals(1, database.getUserDefinedAttributes().size)
    }

    @Test
    fun `discards attribute if key length is more than configured maximum length`() {
        configProvider.defaultMaxUserDefinedAttributeKeyLength = 3
        userDefinedAttribute.put("key", "value1", false)
        userDefinedAttribute.put("longer-length-key", "value2", false)

        assertEquals(1, userDefinedAttribute.getAll().size)
    }

    @Test
    fun `discards attribute if value length is more than configured maximum length`() {
        configProvider.defaultMaxUserDefinedAttributeValueLength = 5
        userDefinedAttribute.put("key1", "value", false)
        userDefinedAttribute.put("key2", "longer-length-value", false)

        assertEquals(1, userDefinedAttribute.getAll().size)
    }

    @Test
    fun `discards attribute if key contains spaces`() {
        configProvider.defaultUserDefinedAttributeKeyWithSpaces = false
        userDefinedAttribute.put("key1", "value1", false)
        userDefinedAttribute.put("key with spaces", "value2", false)

        assertEquals(1, userDefinedAttribute.getAll().size)
    }
}
