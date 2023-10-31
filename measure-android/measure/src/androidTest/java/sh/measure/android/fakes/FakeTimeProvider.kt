package sh.measure.android.fakes

import sh.measure.android.utils.TimeProvider

internal class FakeTimeProvider(private val date: Long = 0) : TimeProvider {
    override val currentTimeSinceEpochInMillis: Long
        get() = date
    override val currentTimeSinceEpochInNanos: Long
        get() = date
    override val uptimeInMillis: Long
        get() = date
}
