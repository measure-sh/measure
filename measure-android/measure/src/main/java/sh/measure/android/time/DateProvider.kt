package sh.measure.android.time

import android.os.SystemClock

/**
 * Provides time from different clocks.
 */
interface DateProvider {
    val currentTimeSinceEpochInMillis: Long
    val uptimeInMillis: Long
}

object AndroidDateProvider : DateProvider {

    /**
     * The standard "wall" clock (time and date) expressing milliseconds since the epoch. The
     * wall clock can be set by the user or the phone network (see setCurrentTimeMillis(long)),
     * so the time may jump backwards or forwards unpredictably.
     */
    override val currentTimeSinceEpochInMillis = System.currentTimeMillis()


    /**
     * Milliseconds since the system was booted. This clock stops when the system enters
     * deep sleep (CPU off, display dark, device waiting for external input), but is not affected
     * by clock scaling, idle, or other power saving mechanisms.
     *
     * [SystemClock] is guaranteed to be monotonic, and is suitable for interval timing. But cannot
     * be used to denote "wall clock" time.
     */
    override val uptimeInMillis = SystemClock.uptimeMillis()

}
