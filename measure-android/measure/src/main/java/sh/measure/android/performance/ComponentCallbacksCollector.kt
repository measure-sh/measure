package sh.measure.android.performance

import android.app.Application
import android.content.ComponentCallbacks2
import android.content.ComponentCallbacks2.TRIM_MEMORY_BACKGROUND
import android.content.ComponentCallbacks2.TRIM_MEMORY_COMPLETE
import android.content.ComponentCallbacks2.TRIM_MEMORY_MODERATE
import android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL
import android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW
import android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_MODERATE
import android.content.ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN
import android.content.res.Configuration
import sh.measure.android.events.EventProcessor
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.TimeProvider

internal class ComponentCallbacksCollector(
    private val application: Application,
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
    private val currentThread: CurrentThread,
    private val memoryReader: MemoryReader,
) : ComponentCallbacks2 {

    fun register() {
        application.registerComponentCallbacks(this)
    }

    override fun onLowMemory() {
        eventProcessor.trackLowMemory(
            LowMemory(
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                java_free_heap = memoryReader.freeHeapSize(),
                java_max_heap = memoryReader.maxHeapSize(),
                java_total_heap = memoryReader.totalHeapSize(),
                native_free_heap = memoryReader.nativeFreeHeapSize(),
                native_total_heap = memoryReader.nativeTotalHeapSize(),
                rss = memoryReader.rss(),
                total_pss = memoryReader.totalPss(),
                thread_name = currentThread.name,
            ),
        )
    }

    override fun onTrimMemory(level: Int) {
        val trimMemory = when (level) {
            TRIM_MEMORY_UI_HIDDEN -> TrimMemory(level = "TRIM_MEMORY_UI_HIDDEN")
            TRIM_MEMORY_RUNNING_MODERATE -> TrimMemory(level = "TRIM_MEMORY_RUNNING_MODERATE")
            TRIM_MEMORY_RUNNING_LOW -> TrimMemory(level = "TRIM_MEMORY_RUNNING_LOW")
            TRIM_MEMORY_RUNNING_CRITICAL -> TrimMemory(level = "TRIM_MEMORY_RUNNING_CRITICAL")
            TRIM_MEMORY_BACKGROUND -> TrimMemory(level = "TRIM_MEMORY_BACKGROUND")
            TRIM_MEMORY_MODERATE -> TrimMemory(level = "TRIM_MEMORY_MODERATE")
            TRIM_MEMORY_COMPLETE -> TrimMemory(level = "TRIM_MEMORY_COMPLETE")
            else -> TrimMemory(level = "TRIM_MEMORY_UNKNOWN")
        }
        eventProcessor.trackTrimMemory(
            trimMemory.copy(
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                thread_name = currentThread.name,
            ),
        )
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        // no-op
    }
}
