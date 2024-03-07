package sh.measure.android.utils

import android.os.Build
import android.os.SystemClock
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * Provides time from different clocks.
 */
internal interface TimeProvider {
    val currentTimeSinceEpochInMillis: Long
    val currentTimeSinceEpochInNanos: Long
    val uptimeInMillis: Long
    val elapsedRealtime: Long
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

    /**
     * Returns milliseconds since boot, including time spent in sleep.
     */
    override val elapsedRealtime
        get() = SystemClock.elapsedRealtime()

    private fun Long.toNanos(): Long {
        return this * 1_000_000
    }
}

private val simpleDateFormat by lazy(LazyThreadSafetyMode.NONE) {
    SimpleDateFormat(
        "yyyy-MM-dd'T'HH:mm:ss.SSSSSSSS'Z'",
        Locale.getDefault(),
    )
}

private val dateTimeFormatter by lazy(LazyThreadSafetyMode.NONE) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSSSSSS'Z'").withZone(ZoneOffset.UTC)
    } else {
        throw IllegalStateException("DateTimeFormatter is not supported on this platform")
    }
}

internal fun Long.iso8601Timestamp(): String {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val formatter = dateTimeFormatter
        val instant = Instant.ofEpochMilli(this)
        formatter.format(instant)
    } else {
        val calendar: Calendar =
            Calendar.getInstance(TimeZone.getTimeZone(TimeZone.getDefault().id))
        calendar.timeInMillis = this
        simpleDateFormat.timeZone = TimeZone.getTimeZone("UTC")
        simpleDateFormat.format(calendar.time)
    }
}
