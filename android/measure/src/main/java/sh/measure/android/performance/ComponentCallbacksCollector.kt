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
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.utils.TimeProvider

internal class ComponentCallbacksCollector(
    private val application: Application,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
) : ComponentCallbacks2 {

    fun register() {
        application.registerComponentCallbacks(this)
    }

    fun unregister() {
        application.unregisterComponentCallbacks(this)
    }

    @Deprecated("Not called since API level 34")
    override fun onLowMemory() {
        // no-op
    }

    override fun onTrimMemory(level: Int) {
        val trimMemoryData = when (level) {
            TRIM_MEMORY_UI_HIDDEN -> TrimMemoryData(level = "TRIM_MEMORY_UI_HIDDEN")
            TRIM_MEMORY_RUNNING_MODERATE -> TrimMemoryData(level = "TRIM_MEMORY_RUNNING_MODERATE")
            TRIM_MEMORY_RUNNING_LOW -> TrimMemoryData(level = "TRIM_MEMORY_RUNNING_LOW")
            TRIM_MEMORY_RUNNING_CRITICAL -> TrimMemoryData(level = "TRIM_MEMORY_RUNNING_CRITICAL")
            TRIM_MEMORY_BACKGROUND -> TrimMemoryData(level = "TRIM_MEMORY_BACKGROUND")
            TRIM_MEMORY_MODERATE -> TrimMemoryData(level = "TRIM_MEMORY_MODERATE")
            TRIM_MEMORY_COMPLETE -> TrimMemoryData(level = "TRIM_MEMORY_COMPLETE")
            else -> TrimMemoryData(level = "TRIM_MEMORY_UNKNOWN")
        }
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.TRIM_MEMORY,
            data = trimMemoryData,
        )
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        // no-op
    }
}
