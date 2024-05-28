package sh.measure.android.utils

import android.app.ActivityManager

/**
 * Utility class to check if the system is in a low memory state.
 */
internal class LowMemoryCheck(private val activityManager: ActivityManager?) {

    /**
     * Returns true if the system is in a low memory state, false otherwise.
     */
    fun isLowMemory(): Boolean {
        if (activityManager == null) {
            return false
        }
        val memoryInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memoryInfo)
        return memoryInfo.lowMemory
    }
}
