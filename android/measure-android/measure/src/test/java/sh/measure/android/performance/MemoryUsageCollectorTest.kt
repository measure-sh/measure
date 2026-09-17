package sh.measure.android.performance

import android.app.ActivityManager.RunningAppProcessInfo
import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.times
import org.mockito.kotlin.whenever
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.fakes.FakeConfigProvider
import sh.measure.android.fakes.FakeMemoryReader
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.TestClock
import java.time.Duration

internal class MemoryUsageCollectorTest {
    private val clock = TestClock.create()
    private val timeProvider = AndroidTimeProvider(clock)
    private val signalProcessor = mock<SignalProcessor>()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val memoryReader = FakeMemoryReader()
    private val processInfo = FakeProcessInfoProvider()
    private val configProvider = FakeConfigProvider()
    private val memoryUsageCollector = MemoryUsageCollector(
        NoopLogger(),
        signalProcessor,
        timeProvider,
        executorService,
        memoryReader,
        processInfo,
        configProvider,
    )

    @Test
    fun `MemoryUsageCollector tracks memory usage`() {
        memoryUsageCollector.register()
        assertEquals(3_000L, executorService.lastScheduledDelayMillis)
        assertEquals(1, memoryReader.procStatusReadCount)
        verify(signalProcessor).track(
            type = EventType.MEMORY_USAGE,
            timestamp = timeProvider.now(),
            data = MemoryUsageData(
                java_max_heap = memoryReader.maxHeapSize(),
                java_total_heap = memoryReader.totalHeapSize(),
                java_free_heap = memoryReader.freeHeapSize(),
                total_pss = memoryReader.totalPss(),
                rss = 1000,
                anon_rss = 800,
                swap = 100,
                app_importance = APP_IMPORTANCE_FOREGROUND,
                native_total_heap = memoryReader.nativeTotalHeapSize(),
                native_free_heap = memoryReader.nativeFreeHeapSize(),
                interval = 0,
            ),
        )
    }

    @Test
    fun `unavailable anonymous RSS and swap remain null on the event`() {
        val collector = MemoryUsageCollector(
            NoopLogger(),
            signalProcessor,
            timeProvider,
            executorService,
            FakeMemoryReader(anonRss = null, swap = null),
            processInfo,
            configProvider,
        )

        collector.register()

        val sample = recordedMemorySamples().single()
        assertNull(sample.anon_rss)
        assertNull(sample.swap)
    }

    @Test
    fun `classifies process importance for memory usage events`() {
        val cases = listOf(
            RunningAppProcessInfo.IMPORTANCE_FOREGROUND to APP_IMPORTANCE_FOREGROUND,
            RunningAppProcessInfo.IMPORTANCE_FOREGROUND_SERVICE to APP_IMPORTANCE_USER_SERVICE,
            RunningAppProcessInfo.IMPORTANCE_SERVICE to APP_IMPORTANCE_BACKGROUND,
        )

        cases.forEach { (importance, _) ->
            processInfo.importance = importance
            memoryUsageCollector.register()

            memoryUsageCollector.unregister()
        }
        assertEquals(cases.map { it.second }, recordedMemorySamples(cases.size).map { it.app_importance })
    }

    @Test
    fun `MemoryUsageCollector does not track memory usage when not foreground process`() {
        processInfo.foregroundProcess = false
        memoryUsageCollector.register()
        assertNull(memoryUsageCollector.future)
    }

    @Test
    fun `continues collecting in background at a 10 second interval`() {
        memoryUsageCollector.register()

        memoryUsageCollector.onAppBackground()

        assertEquals(10_000L, executorService.lastScheduledDelayMillis)
        assertNotNull(memoryUsageCollector.future)
    }

    @Test
    fun `skips background readings for an unsampled session`() {
        whenever(signalProcessor.shouldTrackMemoryUsage()).thenReturn(false)
        memoryUsageCollector.register()

        memoryUsageCollector.onAppBackground()

        assertEquals(1, memoryReader.procStatusReadCount)
    }

    @Test
    fun `collects background readings for a sampled session`() {
        whenever(signalProcessor.shouldTrackMemoryUsage()).thenReturn(true)
        memoryUsageCollector.register()

        memoryUsageCollector.onAppBackground()

        assertEquals(2, memoryReader.procStatusReadCount)
    }

    @Test
    fun `switches back to configured interval in foreground`() {
        memoryUsageCollector.register()
        memoryUsageCollector.onAppBackground()

        memoryUsageCollector.onAppForeground()

        assertEquals(3_000L, executorService.lastScheduledDelayMillis)
    }

    @Test
    fun `calculates interval between two events dynamically`() {
        val initialTimeMillis = timeProvider.elapsedRealtime
        memoryUsageCollector.previousMemoryUsageReadTimeMs = initialTimeMillis

        val advancedTime = Duration.ofMillis(15000)
        clock.advance(advancedTime)
        memoryUsageCollector.register()

        verify(signalProcessor).track(
            type = EventType.MEMORY_USAGE,
            timestamp = timeProvider.now(),
            data = MemoryUsageData(
                java_max_heap = memoryReader.maxHeapSize(),
                java_total_heap = memoryReader.totalHeapSize(),
                java_free_heap = memoryReader.freeHeapSize(),
                total_pss = memoryReader.totalPss(),
                rss = 1000,
                anon_rss = 800,
                swap = 100,
                app_importance = APP_IMPORTANCE_FOREGROUND,
                native_total_heap = memoryReader.nativeTotalHeapSize(),
                native_free_heap = memoryReader.nativeFreeHeapSize(),
                interval = advancedTime.toMillis(),
            ),
        )
    }

    private fun recordedMemorySamples(count: Int = 1): List<MemoryUsageData> {
        val captor = argumentCaptor<MemoryUsageData>()
        verify(signalProcessor, times(count)).track(
            data = captor.capture(),
            timestamp = any(),
            type = eq(EventType.MEMORY_USAGE),
            attributes = any(),
            userDefinedAttributes = any(),
            attachments = any(),
            threadName = isNull(),
            sessionId = isNull(),
            userTriggered = eq(false),
            isSampled = eq(false),
        )
        return captor.allValues
    }
}
