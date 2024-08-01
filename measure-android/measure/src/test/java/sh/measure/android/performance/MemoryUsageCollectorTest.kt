package sh.measure.android.performance

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.fakes.FakeMemoryReader
import sh.measure.android.fakes.FakeProcessInfoProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger

internal class MemoryUsageCollectorTest {
    private lateinit var memoryUsageCollector: MemoryUsageCollector
    private lateinit var timeProvider: FakeTimeProvider
    private val eventProcessor = mock<EventProcessor>()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val memoryReader = FakeMemoryReader()
    private val processInfo = FakeProcessInfoProvider()

    @Before
    fun setUp() {
        val currentElapsedRealtime: Long = 20_000 // 20s
        timeProvider = FakeTimeProvider(fakeElapsedRealtime = currentElapsedRealtime)
        memoryUsageCollector = MemoryUsageCollector(
            NoopLogger(),
            eventProcessor,
            timeProvider,
            executorService,
            memoryReader,
            processInfo,
        )
    }

    @Test
    fun `MemoryUsageCollector tracks memory usage`() {
        memoryUsageCollector.register()
        verify(eventProcessor).track(
            type = EventType.MEMORY_USAGE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
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
    fun `MemoryUsageCollector pauses and resumes`() {
        memoryUsageCollector.register()
        Assert.assertNotNull(memoryUsageCollector.future)
        memoryUsageCollector.pause()
        Assert.assertNull(memoryUsageCollector.future)
        memoryUsageCollector.resume()
        Assert.assertNotNull(memoryUsageCollector.future)
    }

    @Test
    fun `MemoryUsageCollector does not track memory usage when not foreground process`() {
        processInfo.foregroundProcess = false
        memoryUsageCollector.register()
        assertNull(memoryUsageCollector.future)
    }

    @Test
    fun `calculates interval between two events dynamically`() {
        memoryUsageCollector.previousMemoryUsageReadTimeMs = 1000
        memoryUsageCollector.previousMemoryUsage = MemoryUsageData(
            java_max_heap = 0,
            java_total_heap = 0,
            java_free_heap = 0,
            total_pss = 0,
            rss = 0,
            native_total_heap = 0,
            native_free_heap = 0,
            interval = 10_000,
        )
        timeProvider.fakeElapsedRealtime = 15_000
        memoryUsageCollector.register()

        verify(eventProcessor).track(
            type = EventType.MEMORY_USAGE,
            timestamp = timeProvider.currentTimeSinceEpochInMillis,
            data = MemoryUsageData(
                java_max_heap = memoryReader.maxHeapSize(),
                java_total_heap = memoryReader.totalHeapSize(),
                java_free_heap = memoryReader.freeHeapSize(),
                total_pss = memoryReader.totalPss(),
                rss = memoryReader.rss(),
                native_total_heap = memoryReader.nativeTotalHeapSize(),
                native_free_heap = memoryReader.nativeFreeHeapSize(),
                interval = 14_000,
            ),
        )
    }
}
