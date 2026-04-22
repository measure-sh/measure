package sh.measure.android.utils

import android.os.StrictMode

/**
 * Runs the given [block] with [StrictMode.allowThreadDiskWrites] enabled.
 */
internal inline fun runAllowDiskWrites(block: () -> Unit) {
    val oldPolicy = StrictMode.getThreadPolicy()
    StrictMode.setThreadPolicy(StrictMode.allowThreadDiskWrites())
    try {
        block()
    } finally {
        StrictMode.setThreadPolicy(oldPolicy)
    }
}
