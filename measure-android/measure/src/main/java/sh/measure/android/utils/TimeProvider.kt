package sh.measure.android.utils

import android.os.SystemClock
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

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
    override val currentTimeSinceEpochInMillis
        get() = System.currentTimeMillis()

    /**
     * Same as [currentTimeSinceEpochInMillis], but in nanoseconds.
     */
    override val currentTimeSinceEpochInNanos
        get() = currentTimeSinceEpochInMillis.toNanos()

    /**
     * Milliseconds since the system was booted. This clock stops when the system enters
     * deep sleep (CPU off, display dark, device waiting for external input), but is not affected
     * by clock scaling, idle, or other power saving mechanisms.
     *
     * [SystemClock] is guaranteed to be monotonic, and is suitable for interval timing. But cannot
     * be used to denote "wall clock" time.
     */
    override val uptimeInMillis
        get() = SystemClock.uptimeMillis()

    private fun Long.toNanos(): Long {
        return this * 1_000_000
    }
}

internal fun Long.iso8601Timestamp(): String {
    val calendar: Calendar = Calendar.getInstance(TimeZone.getTimeZone(TimeZone.getDefault().id))
    calendar.timeInMillis = this
    val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSSSS'Z'", Locale.getDefault())
    dateFormat.timeZone = TimeZone.getTimeZone("UTC");
    return dateFormat.format(calendar.time)
}