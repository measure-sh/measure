package sh.measure.android.performance

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import sh.measure.android.events.EventTracker
import sh.measure.android.fakes.FakeMemoryReader
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.TimeProvider

internal class MemoryUsageCollectorTest {
    private lateinit var memoryUsageCollector: MemoryUsageCollector
    private lateinit var timeProvider: TimeProvider
    private val eventTracker = mock<EventTracker>()
    private val currentThread = CurrentThread()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val memoryReader = FakeMemoryReader()

    @Before
    fun setUp() {
        val currentElapsedRealtime: Long = 20_000 // 20s
        timeProvider = FakeTimeProvider(fakeElapsedRealtime = currentElapsedRealtime)
        memoryUsageCollector = MemoryUsageCollector(
            eventTracker,
            timeProvider,
            currentThread,
            executorService,
            memoryReader,
        )
    }

    @Test
    fun `MemoryUsageCollector tracks memory usage`() {
        memoryUsageCollector.register()
        verify(eventTracker).trackMemoryUsage(
            MemoryUsage(
                java_max_heap = memoryReader.maxHeapSize(),
                java_total_heap = memoryReader.totalHeapSize(),
                java_free_heap = memoryReader.freeHeapSize(),
                total_pss = memoryReader.totalPss(),
                rss = memoryReader.rss(),
                native_total_heap = memoryReader.nativeTotalHeapSize(),
                native_free_heap = memoryReader.nativeFreeHeapSize(),
                interval_config = MEMORY_TRACKING_INTERVAL_MS,
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                thread_name = currentThread.name,
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
}
