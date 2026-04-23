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
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock

internal class ComponentCallbacksCollectorTest {
    private val signalProcessor = mock<SignalProcessor>()
    private val timeProvider = AndroidTimeProvider(TestClock.create())
    private lateinit var componentCallbacksCollector: ComponentCallbacksCollector

    @Before
    fun setUp() {
        componentCallbacksCollector = ComponentCallbacksCollector(
            mock(),
            signalProcessor,
            timeProvider,
        )
    }

    @Test
    fun `tracks trim memory event`() {
        componentCallbacksCollector.register()
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
        verify(signalProcessor).track(
            type = EventType.TRIM_MEMORY,
            timestamp = timeProvider.now(),
            data = TrimMemoryData(
                level = expectedLevel,
            ),
        )
    }
}
