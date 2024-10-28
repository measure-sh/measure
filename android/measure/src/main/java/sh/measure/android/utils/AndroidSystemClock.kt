package sh.measure.android.utils

import android.os.SystemClock

/**
 * Provides time from an Android device.
 */
internal class AndroidSystemClock : sh.measure.android.utils.SystemClock {
    override fun epochTime(): Long {
        return System.currentTimeMillis()
    }

    override fun monotonicTimeSinceBoot(): Long {
        return SystemClock.elapsedRealtime()
    }
}
