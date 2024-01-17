package sh.measure.android.performance

import android.os.Debug
import androidx.annotation.VisibleForTesting
import sh.measure.android.events.EventTracker
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.DebugProvider
import sh.measure.android.utils.DefaultDebugProvider
import sh.measure.android.utils.DefaultRuntimeProvider
import sh.measure.android.utils.PidProvider
import sh.measure.android.utils.ProcProvider
import sh.measure.android.utils.ProcProviderImpl
import sh.measure.android.utils.RuntimeProvider
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

internal const val MEMORY_TRACKING_INTERVAL_MS = 2000L
internal const val BYTES_TO_KB_FACTOR = 1024
internal const val PAGE_SIZE = 4

internal class MemoryUsageCollector(
    private val logger: Logger,
    private val pidProvider: PidProvider,
    private val eventTracker: EventTracker,
    private val timeProvider: TimeProvider,
    private val currentThread: CurrentThread,
    private val executorService: MeasureExecutorService,
    private val runtimeProvider: RuntimeProvider = DefaultRuntimeProvider(),
    private val debugProvider: DebugProvider = DefaultDebugProvider(),
    private val procProvider: ProcProvider = ProcProviderImpl(),
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
        val maxHeapSize = runtimeProvider.maxMemory() / BYTES_TO_KB_FACTOR
        val totalHeapSize = runtimeProvider.totalMemory() / BYTES_TO_KB_FACTOR
        val freeHeapSize = runtimeProvider.freeMemory() / BYTES_TO_KB_FACTOR
        val totalPss = getTotalPss()
        val rss: Long? = getRss()
        val nativeTotalHeapSize = debugProvider.getNativeHeapSize() / BYTES_TO_KB_FACTOR
        val nativeFreeHeapSize = debugProvider.getNativeHeapFreeSize() / BYTES_TO_KB_FACTOR
        eventTracker.trackMemoryUsage(
            MemoryUsage(
                java_max_heap = maxHeapSize,
                java_total_heap = totalHeapSize,
                java_free_heap = freeHeapSize,
                total_pss = totalPss,
                rss = rss,
                native_total_heap = nativeTotalHeapSize,
                native_free_heap = nativeFreeHeapSize,
                interval_config = MEMORY_TRACKING_INTERVAL_MS,
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                thread_name = currentThread.name,
            ),
        )
    }

    private fun getRss(): Long? {
        val pid = pidProvider.getPid()
        val file = procProvider.getStatmFile(pid)
        if (file.exists()) {
            try {
                val pages = file.readText().split(" ")[1].toLong()
                return pages * PAGE_SIZE
            } catch (e: Exception) {
                logger.log(LogLevel.Error, "Failed to read RSS from /proc/pid/statm", e)
            }
        }
        return null
    }

    private fun getTotalPss(): Int {
        val memoryInfo = Debug.MemoryInfo()
        debugProvider.getMemoryInfo(memoryInfo)
        return memoryInfo.totalPss
    }
}
