package sh.measure.android.utils

import java.time.Duration
import java.util.concurrent.TimeUnit

internal class TestClock private constructor(private var currentEpochMillis: Long) :
    SystemClock {
    fun setTime(time: Long) {
        this.currentEpochMillis = time
    }

    fun advance(duration: Duration) {
        advance(duration.toMillis(), TimeUnit.MILLISECONDS)
    }

    override fun epochTime(): Long {
        return currentEpochMillis
    }

    override fun monotonicTimeSinceBoot(): Long {
        return currentEpochMillis
    }

    private fun advance(duration: Long, unit: TimeUnit) {
        currentEpochMillis += unit.toMillis(duration)
    }

    companion object {
        // Default time set to Wed Oct 25 2023 18:20:15 GMT+0530
        fun create(timeInMillis: Long = 1698238215): TestClock {
            return TestClock(timeInMillis)
        }
    }
}
