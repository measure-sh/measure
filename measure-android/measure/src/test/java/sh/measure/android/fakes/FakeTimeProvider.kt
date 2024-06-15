package sh.measure.android.fakes

import sh.measure.android.utils.TimeProvider

internal class FakeTimeProvider(
    var fakeCurrentTimeSinceEpochInMillis: Long = 0,
    var fakeCurrentTimeSinceEpochInNanos: Long = 0,
    var fakeUptimeMs: Long = 0,
    var fakeElapsedRealtime: Long = 0,
) : TimeProvider {
    override val currentTimeSinceEpochInMillis: Long
        get() = fakeCurrentTimeSinceEpochInMillis
    override val currentTimeSinceEpochInNanos: Long
        get() = fakeCurrentTimeSinceEpochInNanos
    override val uptimeInMillis: Long
        get() = fakeUptimeMs
    override val elapsedRealtime: Long
        get() = fakeElapsedRealtime
}
