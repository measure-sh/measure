package sh.measure.android.utils

import android.app.ActivityManager

/**
 * Returns true if the current process is in the foreground, false otherwise.
 */
internal fun isForegroundProcess(): Boolean {
    val processInfo = ActivityManager.RunningAppProcessInfo()
    ActivityManager.getMyMemoryState(processInfo)
    return processInfo.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
}