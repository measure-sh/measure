package sh.measure.android.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import sh.measure.android.attributes.DoubleAttr
import sh.measure.android.attributes.FloatAttr
import sh.measure.android.attributes.IntAttr
import sh.measure.android.attributes.LongAttr
import sh.measure.android.events.EventType
import sh.measure.android.fakes.TestData
import sh.measure.android.fakes.TestData.toEvent

class EventExtensionsKtTest {

    @Test
    fun `returns null if attributes are empty`() {
        val event =
            TestData.getClickData().toEvent(attributes = mutableMapOf(), type = EventType.CLICK)

        assertNull(event.serializeAttributes())
    }

    @Test
    fun `returns serialized attributes if attributes are not empty`() {
        val event = TestData.getClickData().toEvent(
            attributes = mutableMapOf(
                "key1" to "value1",
                "key2" to "value2",
            ),
            type = EventType.CLICK,
        )

        val serializedAttributes = event.serializeAttributes()
        assertEquals(
            "{\"key1\":\"value1\",\"key2\":\"value2\"}",
            serializedAttributes,
        )
    }

    @Test
    fun `serialization succeeds for known event types`() {
        val exceptionEvent = TestData.getExceptionData().toEvent(type = EventType.EXCEPTION)
        assert(exceptionEvent.serializeDataToString().isNotEmpty())

        val anrEvent = TestData.getExceptionData().toEvent(type = EventType.ANR)
        assert(anrEvent.serializeDataToString().isNotEmpty())

        val clickEvent = TestData.getClickData().toEvent(type = EventType.CLICK)
        assert(clickEvent.serializeDataToString().isNotEmpty())

        val longClickEvent = TestData.getLongClickData().toEvent(type = EventType.LONG_CLICK)
        assert(longClickEvent.serializeDataToString().isNotEmpty())

        val scrollEvent = TestData.getScrollData().toEvent(type = EventType.SCROLL)
        assert(scrollEvent.serializeDataToString().isNotEmpty())

        val lifecycleActivityEvent =
            TestData.getActivityLifecycleData().toEvent(type = EventType.LIFECYCLE_ACTIVITY)
        assert(lifecycleActivityEvent.serializeDataToString().isNotEmpty())

        val lifecycleFragmentEvent =
            TestData.getFragmentLifecycleData().toEvent(type = EventType.LIFECYCLE_FRAGMENT)
        assert(lifecycleFragmentEvent.serializeDataToString().isNotEmpty())

        val applicationLifecycleEvent =
            TestData.getApplicationLifecycleData().toEvent(type = EventType.LIFECYCLE_APP)
        assert(applicationLifecycleEvent.serializeDataToString().isNotEmpty())

        val networkChangeEvent =
            TestData.getNetworkChangeData().toEvent(type = EventType.NETWORK_CHANGE)
        assert(networkChangeEvent.serializeDataToString().isNotEmpty())

        val httpEvent = TestData.getHttpData().toEvent(type = EventType.HTTP)
        assert(httpEvent.serializeDataToString().isNotEmpty())

        val coldLaunchEvent = TestData.getColdLaunchData().toEvent(type = EventType.COLD_LAUNCH)
        assert(coldLaunchEvent.serializeDataToString().isNotEmpty())

        val warmLaunchEvent = TestData.getWarmLaunchData().toEvent(type = EventType.WARM_LAUNCH)
        assert(warmLaunchEvent.serializeDataToString().isNotEmpty())

        val hotLaunchEvent = TestData.getHotLaunchData().toEvent(type = EventType.HOT_LAUNCH)
        assert(hotLaunchEvent.serializeDataToString().isNotEmpty())

        val memoryUsageEvent = TestData.getMemoryUsageData().toEvent(type = EventType.MEMORY_USAGE)
        assert(memoryUsageEvent.serializeDataToString().isNotEmpty())

        val trimMemoryEvent = TestData.getTrimMemoryData().toEvent(type = EventType.TRIM_MEMORY)
        assert(trimMemoryEvent.serializeDataToString().isNotEmpty())

        val cpuUsageEvent = TestData.getCpuUsageData().toEvent(type = EventType.CPU_USAGE)
        assert(cpuUsageEvent.serializeDataToString().isNotEmpty())

        val screenViewEvent = TestData.getScreenViewData().toEvent(type = EventType.SCREEN_VIEW)
        assert(screenViewEvent.serializeDataToString().isNotEmpty())
    }

    @Test
    fun `serialization fails with exception for unknown event type`() {
        val event = TestData.getExceptionData().toEvent(type = "invalid-type")

        assertThrows(IllegalArgumentException::class.java) {
            event.serializeDataToString()
        }
    }

    @Test
    fun `serialization fails with exception for event type mismatch`() {
        val event = TestData.getExceptionData().toEvent(type = EventType.CLICK)

        assertThrows(ClassCastException::class.java) {
            event.serializeDataToString()
        }
    }

    @Test
    fun `user defined attributes with large and small numbers`() {
        val expectedSerializedAttributes = "{\"largest_integer\":2147483647,\"largest_long\":9223372036854775807,\"largest_double\":1.7976931348623157E308,\"largest_float\":3.4028235E38,\"smallest_integer\":-2147483648,\"smallest_long\":-9223372036854775808,\"smallest_double\":4.9E-324,\"smallest_float\":1.4E-45}"
        val event = TestData.getScreenViewData().toEvent(
            type = EventType.CLICK,
            userDefinedAttributes = mapOf(
                "largest_integer" to IntAttr(Int.MAX_VALUE),
                "largest_long" to LongAttr(Long.MAX_VALUE),
                "largest_double" to DoubleAttr(Double.MAX_VALUE),
                "largest_float" to FloatAttr(Float.MAX_VALUE),
                "smallest_integer" to IntAttr(Int.MIN_VALUE),
                "smallest_long" to LongAttr(Long.MIN_VALUE),
                "smallest_double" to DoubleAttr(Double.MIN_VALUE),
                "smallest_float" to FloatAttr(Float.MIN_VALUE),
            ),
        )
        val serializedAttributes = event.serializeUserDefinedAttributes()
        assertEquals(expectedSerializedAttributes, serializedAttributes)
    }
}
