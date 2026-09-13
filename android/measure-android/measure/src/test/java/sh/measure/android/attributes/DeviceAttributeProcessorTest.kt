package sh.measure.android.attributes

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.system.OsConstants
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeLocaleProvider
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent
import sh.measure.android.storage.serializeAttributes
import sh.measure.android.utils.OsSysConfProvider
import sh.measure.android.utils.SystemServiceProvider

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [Build.VERSION_CODES.Q])
class DeviceAttributeProcessorTest {
    private val context: Context = InstrumentationRegistry.getInstrumentation().context
    private val activityManager = mock<ActivityManager>()
    private val systemServiceProvider = mock<SystemServiceProvider>()
    private val osSysConfProvider = mock<OsSysConfProvider>()
    private var totalMemBytes = 8L * 1024 * 1024 * 1024

    @Before
    fun setUp() {
        whenever(systemServiceProvider.activityManager).thenReturn(activityManager)
        whenever(osSysConfProvider.get(OsConstants._SC_PAGESIZE)).thenReturn(4096)
        doAnswer { invocation ->
            invocation.getArgument<ActivityManager.MemoryInfo>(0).apply {
                totalMem = totalMemBytes
                availMem = 1024
            }
            null
        }.whenever(activityManager).getMemoryInfo(any())
    }

    @Test
    fun `adds total RAM in KB to memory and non-memory events and reads it once`() {
        val processor = createProcessor()
        val events = listOf(
            TestData.getMemoryUsageData().toEvent(type = EventType.MEMORY_USAGE),
            TestData.getExceptionData().toEvent(type = EventType.EXCEPTION),
        )

        events.forEach { event ->
            event.appendAttributes(listOf(processor))

            assertEquals(8_388_608L, event.attributes["device_total_memory"])
            val json = Json.parseToJsonElement(event.serializeAttributes()!!).jsonObject
            assertEquals(8_388_608L, json.getValue("device_total_memory").jsonPrimitive.long)
        }
        verify(activityManager, times(1)).getMemoryInfo(any())
    }

    @Test
    fun `converts bytes to KB using integer division`() {
        totalMemBytes = 4096 + 1023

        assertEquals(4L, createProcessor().computeAttributes()[Attribute.DEVICE_TOTAL_MEMORY_KEY])
    }

    @Test
    fun `invalid total RAM is unavailable`() {
        for (invalid in listOf(0L, -1L, 1023L)) {
            totalMemBytes = invalid

            assertNull(createProcessor().computeAttributes()[Attribute.DEVICE_TOTAL_MEMORY_KEY])
        }
    }

    @Test
    fun `missing activity manager preserves other device attributes`() {
        whenever(systemServiceProvider.activityManager).thenReturn(null)
        val attributes = createProcessor().computeAttributes()

        assertNull(attributes[Attribute.DEVICE_TOTAL_MEMORY_KEY])
        assertEquals("android", attributes[Attribute.OS_NAME_KEY])
        assertTrue(attributes.containsKey(Attribute.DEVICE_MODEL_KEY))
    }

    @Test
    fun `memory info failure preserves other device attributes`() {
        doThrow(IllegalStateException("Memory info unavailable"))
            .whenever(activityManager).getMemoryInfo(any())

        val attributes = createProcessor().computeAttributes()

        assertNull(attributes[Attribute.DEVICE_TOTAL_MEMORY_KEY])
        assertEquals("android", attributes[Attribute.OS_NAME_KEY])
    }

    private fun createProcessor() = DeviceAttributeProcessor(
        context = context,
        localeProvider = FakeLocaleProvider(),
        osSysConfProvider = osSysConfProvider,
        systemServiceProvider = systemServiceProvider,
    )
}
