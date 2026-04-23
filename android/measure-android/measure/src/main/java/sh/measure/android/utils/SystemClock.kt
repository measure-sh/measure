package sh.measure.android.utils

/**
 * Provides current time from the system.
 */
internal interface SystemClock {
    /**
     * Returns current time in epoch milliseconds.
     */
    fun epochTime(): Long

    /**
     * Returns milliseconds since boot, including time spent in sleep.
     */
    fun monotonicTimeSinceBoot(): Long
}
