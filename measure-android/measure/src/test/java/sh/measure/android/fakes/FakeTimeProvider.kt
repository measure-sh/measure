package sh.measure.android.fakes

import sh.measure.android.utils.TimeProvider

internal class FakeTimeProvider(
    private val time: Long = 0,
    private val fakeElapsedRealtime: Long = 0,
) : TimeProvider {
    override val currentTimeSinceEpochInMillis: Long
        get() = time
    override val currentTimeSinceEpochInNanos: Long
        get() = time
    override val uptimeInMillis: Long
        get() = time
    override val elapsedRealtime: Long
        get() = fakeElapsedRealtime
}
