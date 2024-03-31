package sh.measure.android.performance

import android.content.ComponentCallbacks2.TRIM_MEMORY_BACKGROUND
import android.content.ComponentCallbacks2.TRIM_MEMORY_COMPLETE
import android.content.ComponentCallbacks2.TRIM_MEMORY_MODERATE
import android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL
import android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW
import android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_MODERATE
import android.content.ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import sh.measure.android.events.Event
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeMemoryReader
import sh.measure.android.fakes.FakeTimeProvider

internal class ComponentCallbacksCollectorTest {
    private val eventProcessor = mock<EventProcessor>()
    private val timeProvider = FakeTimeProvider()
    private val memoryReader = FakeMemoryReader()
    private lateinit var componentCallbacksCollector: ComponentCallbacksCollector

    @Before
    fun setUp() {
        componentCallbacksCollector = ComponentCallbacksCollector(
            mock(),
            eventProcessor,
            timeProvider,
            memoryReader,
        ).apply { register() }
    }

    @Test
    fun `ComponentCallbacksCollector tracks low memory event`() {
        componentCallbacksCollector.onLowMemory()

        verify(eventProcessor).trackLowMemory(
            Event(
                type = EventType.LOW_MEMORY,
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                data = LowMemoryData(
                    java_max_heap = memoryReader.maxHeapSize(),
                    java_free_heap = memoryReader.freeHeapSize(),
                    java_total_heap = memoryReader.totalHeapSize(),
                    native_free_heap = memoryReader.nativeFreeHeapSize(),
                    native_total_heap = memoryReader.nativeTotalHeapSize(),
                    rss = memoryReader.rss(),
                    total_pss = memoryReader.totalPss(),
                ),
            ),
        )
    }

    @Test
    fun `ComponentCallbacksCollector tracks trim memory event`() {
        testTrimMemoryEvent(TRIM_MEMORY_UI_HIDDEN, "TRIM_MEMORY_UI_HIDDEN")
        testTrimMemoryEvent(TRIM_MEMORY_RUNNING_MODERATE, "TRIM_MEMORY_RUNNING_MODERATE")
        testTrimMemoryEvent(TRIM_MEMORY_RUNNING_LOW, "TRIM_MEMORY_RUNNING_LOW")
        testTrimMemoryEvent(TRIM_MEMORY_RUNNING_CRITICAL, "TRIM_MEMORY_RUNNING_CRITICAL")
        testTrimMemoryEvent(TRIM_MEMORY_BACKGROUND, "TRIM_MEMORY_BACKGROUND")
        testTrimMemoryEvent(TRIM_MEMORY_MODERATE, "TRIM_MEMORY_MODERATE")
        testTrimMemoryEvent(TRIM_MEMORY_COMPLETE, "TRIM_MEMORY_COMPLETE")
        testTrimMemoryEvent(999, "TRIM_MEMORY_UNKNOWN")
    }

    private fun testTrimMemoryEvent(trimLevel: Int, expectedLevel: String) {
        componentCallbacksCollector.onTrimMemory(trimLevel)
        verify(eventProcessor).trackTrimMemory(
            Event(
                type = EventType.TRIM_MEMORY,
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                data = TrimMemoryData(
                    level = expectedLevel,
                ),
            ),
        )
    }
}
