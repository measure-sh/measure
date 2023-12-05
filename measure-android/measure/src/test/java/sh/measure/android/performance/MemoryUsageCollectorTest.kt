package sh.measure.android.performance

import androidx.concurrent.futures.ResolvableFuture
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import sh.measure.android.events.EventTracker
import sh.measure.android.fakes.FakePidProvider
import sh.measure.android.fakes.FakeTimeProvider
import sh.measure.android.fakes.ImmediateExecutorService
import sh.measure.android.fakes.NoopLogger
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.DebugProvider
import sh.measure.android.utils.ProcProvider
import sh.measure.android.utils.RuntimeProvider
import sh.measure.android.utils.TimeProvider
import java.io.File

internal class MemoryUsageCollectorTest {
    private lateinit var memoryUsageCollector: MemoryUsageCollector
    private lateinit var timeProvider: TimeProvider
    private val logger = NoopLogger()
    private val eventTracker = mock<EventTracker>()
    private val pidProvider = FakePidProvider()
    private val currentThread = CurrentThread()
    private val executorService = ImmediateExecutorService(ResolvableFuture.create<Any>())
    private val runtimeProvider = mock<RuntimeProvider>()
    private val debugProvider = mock<DebugProvider>()
    private val procProvider = mock<ProcProvider>()

    private val maxHeapSize = 100000L
    private val totalHeapSize = 50000L
    private val freeHeapSize = 25000L
    private val totalPss = 0 // unable to stub totalPss as Debug.getMemoryInfo() mutates the input
    private val rss = 5000L * PAGE_SIZE
    private val nativeTotalHeapSize = 100000L
    private val nativeFreeHeapSize = 50000L
    private val pid = pidProvider.getPid()

    @Before
    fun setUp() {
        val currentElapsedRealtime: Long = 20_000 // 20s
        timeProvider = FakeTimeProvider(fakeElapsedRealtime = currentElapsedRealtime)
        memoryUsageCollector = MemoryUsageCollector(
            logger,
            pidProvider,
            eventTracker,
            timeProvider,
            currentThread,
            executorService,
            runtimeProvider,
            debugProvider,
            procProvider
        )
        // setup mocks
        `when`(procProvider.getStatmFile(pid)).thenReturn(createDummyProcStatmFile())
        `when`(runtimeProvider.maxMemory()).thenReturn(maxHeapSize)
        `when`(runtimeProvider.totalMemory()).thenReturn(totalHeapSize)
        `when`(runtimeProvider.freeMemory()).thenReturn(freeHeapSize)
        `when`(debugProvider.getNativeHeapSize()).thenReturn(nativeTotalHeapSize)
        `when`(debugProvider.getNativeHeapFreeSize()).thenReturn(nativeFreeHeapSize)
    }

    /**
     * The second value in this file corresponds to resident set size pages.
     */
    private fun createDummyProcStatmFile(): File {
        return File.createTempFile("statm", "").apply {
            writeText("100000 5000 2000 1000 500 0 0")
        }
    }

    @Test
    fun `MemoryUsageCollector tracks memory usage`() {
        memoryUsageCollector.register()
        verify(eventTracker).trackMemoryUsage(
            MemoryUsage(
                java_max_heap = maxHeapSize / BYTES_TO_KB_FACTOR,
                java_total_heap = totalHeapSize / BYTES_TO_KB_FACTOR,
                java_free_heap = freeHeapSize / BYTES_TO_KB_FACTOR,
                total_pss = totalPss,
                rss = rss,
                native_total_heap = nativeTotalHeapSize / BYTES_TO_KB_FACTOR,
                native_free_heap = nativeFreeHeapSize / BYTES_TO_KB_FACTOR,
                interval_config = MEMORY_TRACKING_INTERVAL_MS,
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                thread_name = currentThread.name
            )
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