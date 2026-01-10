package sh.measure.android.performance

import androidx.annotation.VisibleForTesting
import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.Future
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit

internal const val BYTES_TO_KB_FACTOR = 1024

internal class MemoryUsageCollector(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val defaultExecutor: MeasureExecutorService,
    private val memoryReader: MemoryReader,
    private val processInfo: ProcessInfoProvider,
    private val configProvider: ConfigProvider,
) {
    @VisibleForTesting
    var future: Future<*>? = null

    @VisibleForTesting
    internal var previousMemoryUsage: MemoryUsageData? = null

    @VisibleForTesting
    internal var previousMemoryUsageReadTimeMs = 0L

    fun register() {
        if (!processInfo.isForegroundProcess()) return
        if (future != null) return
        future = try {
            defaultExecutor.scheduleAtFixedRate(
                {
                    trackMemoryUsage()
                },
                0,
                configProvider.memoryUsageInterval,
                TimeUnit.SECONDS,
            )
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Failed to start MemoryUsageCollector", e)
            null
        }
    }

    fun unregister() {
        future?.cancel(false)
        future = null
    }

    fun onConfigLoaded() {
        // re-register to reflect updated interval
        if (future == null) return
        unregister()
        register()
    }

    private fun trackMemoryUsage() {
        val interval = getInterval()
        previousMemoryUsageReadTimeMs = timeProvider.elapsedRealtime

        val data = MemoryUsageData(
            java_max_heap = memoryReader.maxHeapSize(),
            java_total_heap = memoryReader.totalHeapSize(),
            java_free_heap = memoryReader.freeHeapSize(),
            total_pss = memoryReader.totalPss(),
            rss = memoryReader.rss(),
            native_total_heap = memoryReader.nativeTotalHeapSize(),
            native_free_heap = memoryReader.nativeFreeHeapSize(),
            interval = interval,
        )
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.MEMORY_USAGE,
            data = data,
        )
        previousMemoryUsage = data
    }

    private fun getInterval(): Long {
        val currentTime = timeProvider.elapsedRealtime
        return if (previousMemoryUsageReadTimeMs != 0L) {
            (currentTime - previousMemoryUsageReadTimeMs).coerceAtLeast(0)
        } else {
            0
        }
    }
}
