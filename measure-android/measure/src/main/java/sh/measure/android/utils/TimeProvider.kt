package sh.measure.android.utils

import android.os.SystemClock
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Provides time from different clocks.
 */
interface TimeProvider {
    val currentTimeSinceEpochInMillis: Long
    val currentTimeSinceEpochInNanos: Long
    val uptimeInMillis: Long
}

internal class AndroidTimeProvider : TimeProvider {

    /**
     * The standard "wall" clock (time and date) expressing milliseconds since the epoch. The
     * wall clock can be set by the user or the phone network (see setCurrentTimeMillis(long)),
     * so the time may jump backwards or forwards unpredictably.
     */
    override val currentTimeSinceEpochInMillis = System.currentTimeMillis()

    /**
     * Same as [currentTimeSinceEpochInMillis], but in nanoseconds.
     */
    override val currentTimeSinceEpochInNanos = currentTimeSinceEpochInMillis.toNanos()

    /**
     * Milliseconds since the system was booted. This clock stops when the system enters
     * deep sleep (CPU off, display dark, device waiting for external input), but is not affected
     * by clock scaling, idle, or other power saving mechanisms.
     *
     * [SystemClock] is guaranteed to be monotonic, and is suitable for interval timing. But cannot
     * be used to denote "wall clock" time.
     */
    override val uptimeInMillis = SystemClock.uptimeMillis()

    private fun Long.toNanos(): Long {
        return this * 1_000_000
    }
}

internal fun Long.iso8601Timestamp(): String {
    val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSSSSS'Z'", Locale.US)
    return sdf.format(this)
}