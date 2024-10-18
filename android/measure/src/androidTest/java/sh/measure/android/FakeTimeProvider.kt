package sh.measure.android

import sh.measure.android.utils.TimeProvider

class FakeTimeProvider(
    override var currentTimeSinceEpochInMillis: Long = 0,
    override var currentTimeSinceEpochInNanos: Long = 0,
    override var uptimeInMillis: Long = 0,
    override var elapsedRealtime: Long = 0,
) : TimeProvider
