package sh.measure.android.attributes

import androidx.concurrent.futures.ResolvableFuture
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import sh.measure.android.attributes.Attribute.USER_ID_KEY
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.storage.PrefsStorageImpl
import sh.measure.android.utils.ValidationLimits

// this test uses a real instance of shared preferences, hence uses Robolectric
@RunWith(AndroidJUnit4::class)
class UserAttributeProcessorTest {
    private val logger = NoopLogger()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val prefsStorage =
        PrefsStorageImpl(InstrumentationRegistry.getInstrumentation().context)
    private val userAttributeProcessor =
        UserAttributeProcessor(logger, prefsStorage, executorService)

    @Test
    fun `sets user id in memory and updates shared prefs`() {
        userAttributeProcessor.setUserId("user-id")

        assertEquals("user-id", userAttributeProcessor.getUserId())
        assertEquals("user-id", prefsStorage.getUserId())
    }

    @Test
    fun `clears user id from memory and shared prefs`() {
        userAttributeProcessor.setUserId("user-id")
        userAttributeProcessor.clearUserId()

        assertEquals(null, userAttributeProcessor.getUserId())
        assertEquals(null, prefsStorage.getUserId())
    }

    @Test
    fun `appends user id to attributes from memory`() {
        userAttributeProcessor.setUserId("user-id")
        val attributes = mutableMapOf<String, Any?>()
        userAttributeProcessor.appendAttributes(attributes)

        assertEquals("user-id", attributes[USER_ID_KEY])
    }

    @Test
    fun `appends user id to attributes from shared prefs`() {
        prefsStorage.setUserId("user-id")
        val attributes = mutableMapOf<String, Any?>()
        userAttributeProcessor.appendAttributes(attributes)

        assertEquals("user-id", attributes[USER_ID_KEY])
    }

    @Test
    fun `ignores user id that exceeds the maximum length`() {
        userAttributeProcessor.setUserId("user-id")
        userAttributeProcessor.setUserId("u".repeat(ValidationLimits.USER_ID + 1))

        assertEquals("user-id", userAttributeProcessor.getUserId())
        assertEquals("user-id", prefsStorage.getUserId())
    }

    @Test
    fun `accepts user id at the maximum length`() {
        val userId = "u".repeat(ValidationLimits.USER_ID)
        userAttributeProcessor.setUserId(userId)

        assertEquals(userId, userAttributeProcessor.getUserId())
    }

    @Test
    fun `clears user id persisted by an older version that exceeds the maximum length`() {
        prefsStorage.setUserId("u".repeat(ValidationLimits.USER_ID + 1))
        val attributes = mutableMapOf<String, Any?>()
        userAttributeProcessor.appendAttributes(attributes)

        assertEquals(null, attributes[USER_ID_KEY])
        assertEquals(null, userAttributeProcessor.getUserId())
        assertEquals(null, prefsStorage.getUserId())
    }
}
