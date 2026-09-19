package sh.measure.android.performance

import android.app.ActivityManager.RunningAppProcessInfo
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
private const val BACKGROUND_MEMORY_USAGE_INTERVAL_SECONDS = 10L
internal const val APP_IMPORTANCE_FOREGROUND = "foreground"
internal const val APP_IMPORTANCE_USER_SERVICE = "user_service"
internal const val APP_IMPORTANCE_BACKGROUND = "background"

internal class MemoryUsageCollector(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val defaultExecutor: MeasureExecutorService,
    private val memoryReader: MemoryReader,
    private val processInfo: ProcessInfoProvider,
    private val configProvider: ConfigProvider,
) {
    private var isInForeground = true

    @VisibleForTesting
    var future: Future<*>? = null

    @VisibleForTesting
    internal var previousMemoryUsageReadTimeMs = 0L

    fun register() {
        if (!processInfo.isForegroundProcess()) return
        if (future != null) return
        isInForeground = true
        schedule()
    }

    fun onAppForeground() {
        isInForeground = true
        if (future == null) register() else reschedule()
    }

    fun onAppBackground() {
        isInForeground = false
        if (future != null) reschedule()
    }

    fun unregister() {
        future?.cancel(false)
        future = null
    }

    fun onConfigLoaded() {
        // re-register to reflect updated interval
        if (future == null) return
        reschedule()
    }

    private fun reschedule() {
        future?.cancel(false)
        future = null
        schedule()
    }

    private fun schedule() {
        future = try {
            defaultExecutor.scheduleAtFixedRate(
                { trackMemoryUsage() },
                0,
                if (isInForeground) configProvider.memoryUsageInterval else BACKGROUND_MEMORY_USAGE_INTERVAL_SECONDS,
                TimeUnit.SECONDS,
            )
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Failed to start MemoryUsageCollector", e)
            null
        }
    }

    private fun trackMemoryUsage() {
        if (!isInForeground && !signalProcessor.shouldTrackMemoryUsage()) return
        val interval = getInterval()
        previousMemoryUsageReadTimeMs = timeProvider.elapsedRealtime
        val maxHeapSize = sanitizeNegativeValue(memoryReader.maxHeapSize())
        val totalHeapSize = sanitizeNegativeValue(memoryReader.totalHeapSize())
        val freeHeapSize = sanitizeNegativeValue(memoryReader.freeHeapSize())
        val totalPss = sanitizeNegativeValue(memoryReader.totalPss())
        val procStatus = memoryReader.readProcStatus()
        val rss = sanitizeNegativeValue(procStatus.rss ?: 0)
        val nativeTotalHeapSize = sanitizeNegativeValue(memoryReader.nativeTotalHeapSize())
        val nativeFreeHeap = sanitizeNegativeValue(memoryReader.nativeFreeHeapSize())

        val data = MemoryUsageData(
            java_max_heap = maxHeapSize,
            java_total_heap = totalHeapSize,
            java_free_heap = freeHeapSize,
            total_pss = totalPss,
            rss = rss,
            native_total_heap = nativeTotalHeapSize,
            native_free_heap = nativeFreeHeap,
            interval = interval,
            anon_rss = procStatus.anonRss?.let { sanitizeNegativeValue(it) },
            swap = procStatus.swap?.let { sanitizeNegativeValue(it) },
            app_importance = processImportance(),
        )
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.MEMORY_USAGE,
            data = data,
        )
    }

    private fun processImportance(): String = when (processInfo.getProcessImportance()) {
        RunningAppProcessInfo.IMPORTANCE_FOREGROUND -> APP_IMPORTANCE_FOREGROUND
        RunningAppProcessInfo.IMPORTANCE_FOREGROUND_SERVICE -> APP_IMPORTANCE_USER_SERVICE
        else -> APP_IMPORTANCE_BACKGROUND
    }

    private fun getInterval(): Long {
        val currentTime = timeProvider.elapsedRealtime
        return if (previousMemoryUsageReadTimeMs != 0L) {
            (currentTime - previousMemoryUsageReadTimeMs).coerceAtLeast(0)
        } else {
            0
        }
    }

    private fun sanitizeNegativeValue(value: Long): Long {
        if (value < 0) {
            logger.log(
                LogLevel.Debug,
                "MemoryUsageCollector: Got a negative memory value: $value, resetting to 0",
            )
            return 0
        }
        return value
    }

    private fun sanitizeNegativeValue(value: Int): Int {
        if (value < 0) {
            logger.log(
                LogLevel.Debug,
                "MemoryUsageCollector: Got a negative memory value: $value, resetting to 0",
            )
            return 0
        }
        return value
    }
}
