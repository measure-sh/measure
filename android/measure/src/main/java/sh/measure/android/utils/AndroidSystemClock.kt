package sh.measure.android.utils

import android.os.SystemClock

/**
 * Provides time from an Android device.
 */
internal class AndroidSystemClock : sh.measure.android.utils.SystemClock {
    override fun epochTime(): Long = System.currentTimeMillis()

    override fun monotonicTimeSinceBoot(): Long = SystemClock.elapsedRealtime()
}
