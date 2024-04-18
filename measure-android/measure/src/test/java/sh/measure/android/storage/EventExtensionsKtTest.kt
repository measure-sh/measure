package sh.measure.android.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import sh.measure.android.events.Attachment
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeEventFactory
import sh.measure.android.fakes.FakeEventFactory.toEvent

class EventExtensionsKtTest {

    @Test
    fun `returns null if attributes are empty`() {
        val event = FakeEventFactory.getClickData()
            .toEvent(attributes = mutableMapOf(), type = EventType.CLICK)

        assertNull(event.serializeAttributes())
    }

    @Test
    fun `returns serialized attributes if attributes are not empty`() {
        val event = FakeEventFactory.getClickData()
            .toEvent(attributes = mutableMapOf(
                "key1" to "value1",
                "key2" to "value2"
            ), type = EventType.CLICK)

        val serializedAttributes = event.serializeAttributes()
        assertEquals(
            "{\"key1\":\"value1\",\"key2\":\"value2\"}",
            serializedAttributes
        )
    }

    @Test
    fun `returns null if attachments are null`() {
        val event = FakeEventFactory.getClickData()
            .toEvent(attachments = null, type = EventType.CLICK)

        assertNull(event.serializeAttachments())
    }

    @Test
    fun `returns serialized attachments if attachments are not empty`() {
        val event = FakeEventFactory.getClickData()
            .toEvent(attachments = listOf(
                Attachment(
                    name = "screenshot.png",
                    type = "image/png",
                    bytes = byteArrayOf(1, 2, 3, 4),
                )
            ), type = EventType.CLICK)

        val serializedAttachments = event.serializeAttachments()
        assertEquals(
            "[{\"name\":\"screenshot.png\",\"type\":\"image/png\"}]",
            serializedAttachments
        )
    }

    @Test
    fun `serialization succeeds for known event types`() {
        val exceptionEvent = FakeEventFactory.getExceptionData().toEvent(type = EventType.EXCEPTION)
        assert(exceptionEvent.serializeDataToString().isNotEmpty())

        val anrEvent = FakeEventFactory.getExceptionData().toEvent(type = EventType.ANR)
        assert(anrEvent.serializeDataToString().isNotEmpty())

        val clickEvent = FakeEventFactory.getClickData().toEvent(type = EventType.CLICK)
        assert(clickEvent.serializeDataToString().isNotEmpty())

        val longClickEvent = FakeEventFactory.getLongClickData().toEvent(type = EventType.LONG_CLICK)
        assert(longClickEvent.serializeDataToString().isNotEmpty())

        val scrollEvent = FakeEventFactory.getScrollData().toEvent(type = EventType.SCROLL)
        assert(scrollEvent.serializeDataToString().isNotEmpty())

        val lifecycleActivityEvent = FakeEventFactory.getActivityLifecycleData().toEvent(type = EventType.LIFECYCLE_ACTIVITY)
        assert(lifecycleActivityEvent.serializeDataToString().isNotEmpty())

        val lifecycleFragmentEvent = FakeEventFactory.getFragmentLifecycleData().toEvent(type = EventType.LIFECYCLE_FRAGMENT)
        assert(lifecycleFragmentEvent.serializeDataToString().isNotEmpty())

        val applicationLifecycleEvent = FakeEventFactory.getApplicationLifecycleData().toEvent(type = EventType.LIFECYCLE_APP)
        assert(applicationLifecycleEvent.serializeDataToString().isNotEmpty())

        val networkChangeEvent = FakeEventFactory.getNetworkChangeData().toEvent(type = EventType.NETWORK_CHANGE)
        assert(networkChangeEvent.serializeDataToString().isNotEmpty())

        val httpEvent = FakeEventFactory.getHttpData().toEvent(type = EventType.HTTP)
        assert(httpEvent.serializeDataToString().isNotEmpty())

        val coldLaunchEvent = FakeEventFactory.getColdLaunchData().toEvent(type = EventType.COLD_LAUNCH)
        assert(coldLaunchEvent.serializeDataToString().isNotEmpty())

        val warmLaunchEvent = FakeEventFactory.getWarmLaunchData().toEvent(type = EventType.WARM_LAUNCH)
        assert(warmLaunchEvent.serializeDataToString().isNotEmpty())

        val hotLaunchEvent = FakeEventFactory.getHotLaunchData().toEvent(type = EventType.HOT_LAUNCH)
        assert(hotLaunchEvent.serializeDataToString().isNotEmpty())

        val memoryUsageEvent = FakeEventFactory.getMemoryUsageData().toEvent(type = EventType.MEMORY_USAGE)
        assert(memoryUsageEvent.serializeDataToString().isNotEmpty())

        val trimMemoryEvent = FakeEventFactory.getTrimMemoryData().toEvent(type = EventType.TRIM_MEMORY)
        assert(trimMemoryEvent.serializeDataToString().isNotEmpty())

        val cpuUsageEvent = FakeEventFactory.getCpuUsageData().toEvent(type = EventType.CPU_USAGE)
        assert(cpuUsageEvent.serializeDataToString().isNotEmpty())

        val navigationEvent = FakeEventFactory.getNavigationData().toEvent(type = EventType.NAVIGATION)
        assert(navigationEvent.serializeDataToString().isNotEmpty())

        val lowMemoryEvent = FakeEventFactory.getLowMemoryData().toEvent(type = EventType.LOW_MEMORY)
        assert(lowMemoryEvent.serializeDataToString().isNotEmpty())
    }

    @Test
    fun `serialization fails with exception for unknown event type`() {
        val event = FakeEventFactory.getExceptionData().toEvent(type = "invalid-type")

        assertThrows(IllegalArgumentException::class.java) {
            event.serializeDataToString()
        }
    }

    @Test
    fun `serialization fails with exception for event type mismatch`() {
        val event = FakeEventFactory.getExceptionData().toEvent(type = EventType.CLICK)

        assertThrows(ClassCastException::class.java) {
            event.serializeDataToString()
        }
    }
}