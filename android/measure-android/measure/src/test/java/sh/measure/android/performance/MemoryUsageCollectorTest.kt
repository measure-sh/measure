package sh.measure.android.performance

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert.assertNull
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
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
        verify(signalProcessor).track(
            type = EventType.MEMORY_USAGE,
            timestamp = timeProvider.now(),
            data = MemoryUsageData(
                java_max_heap = memoryReader.maxHeapSize(),
                java_total_heap = memoryReader.totalHeapSize(),
                java_free_heap = memoryReader.freeHeapSize(),
                total_pss = memoryReader.totalPss(),
                rss = memoryReader.rss(),
                native_total_heap = memoryReader.nativeTotalHeapSize(),
                native_free_heap = memoryReader.nativeFreeHeapSize(),
                interval = 0,
            ),
        )
    }

    @Test
    fun `MemoryUsageCollector does not track memory usage when not foreground process`() {
        processInfo.foregroundProcess = false
        memoryUsageCollector.register()
        assertNull(memoryUsageCollector.future)
    }

    @Test
    fun `calculates interval between two events dynamically`() {
        val initialTimeMillis = timeProvider.elapsedRealtime
        memoryUsageCollector.previousMemoryUsageReadTimeMs = initialTimeMillis
        memoryUsageCollector.previousMemoryUsage = MemoryUsageData(
            java_max_heap = 0,
            java_total_heap = 0,
            java_free_heap = 0,
            total_pss = 0,
            rss = 0,
            native_total_heap = 0,
            native_free_heap = 0,
            interval = 0,
        )

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
                rss = memoryReader.rss(),
                native_total_heap = memoryReader.nativeTotalHeapSize(),
                native_free_heap = memoryReader.nativeFreeHeapSize(),
                interval = advancedTime.toMillis(),
            ),
        )
    }
}
