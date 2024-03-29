package sh.measure.android.performance

import androidx.annotation.VisibleForTesting
import sh.measure.android.events.EventProcessor
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

internal const val MEMORY_TRACKING_INTERVAL_MS = 2000L
internal const val BYTES_TO_KB_FACTOR = 1024

internal class MemoryUsageCollector(
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
    private val executorService: MeasureExecutorService,
    private val memoryReader: MemoryReader,
) {
    @VisibleForTesting
    var future: Future<*>? = null

    fun register() {
        if (future != null) return
        future = executorService.scheduleAtFixedRate(
            {
                trackMemoryUsage()
            },
            0,
            MEMORY_TRACKING_INTERVAL_MS,
            TimeUnit.MILLISECONDS,
        )
    }

    fun resume() {
        if (future == null) register()
    }

    fun pause() {
        future?.cancel(false)
        future = null
    }

    private fun trackMemoryUsage() {
        eventProcessor.trackMemoryUsage(
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
            ),
        )
    }
}
