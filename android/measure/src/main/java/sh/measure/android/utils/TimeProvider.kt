package sh.measure.android.utils

import android.os.Build
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * Provides current time.
 */
internal interface TimeProvider {
    /**
     * Returns a time measurement with millisecond precision that can only be used to calculate
     * time intervals.
     */
    val elapsedRealtime: Long

    /**
     * Returns the current epoch timestamp in millis. This timestamp is calculated using
     * a monotonic clock, with initial epoch time set to the time on the device during
     * initialization.
     *
     * Once the time provider is initialized, this time does not get affected by clock skew.
     * However, the initial time used during initialization can be affected by clock skew.
     */
    fun now(): Long
}

internal class AndroidTimeProvider(private val systemClock: SystemClock) : TimeProvider {
    private val anchoredEpochTime = systemClock.epochTime()
    private val anchoredElapsedRealtime = systemClock.monotonicTimeSinceBoot()

    override val elapsedRealtime
        get() = systemClock.monotonicTimeSinceBoot()

    override fun now(): Long = anchoredEpochTime + (systemClock.monotonicTimeSinceBoot() - anchoredElapsedRealtime)
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

internal fun Long.iso8601Timestamp(): String = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
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
