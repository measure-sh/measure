package sh.measure.android.cold_launch

import android.os.Build.VERSION
import android.os.Build.VERSION_CODES
import android.os.Process
import android.util.Log
import sh.measure.android.MeasureInitProvider

/**
 * A singleton which holds the state of the app launch.
 *
 * This information is used by [ColdLaunchCollector] to calculate the cold launch time.
 */
internal object LaunchState {
    var contentProviderLoadTime: Long? = null
    val startUptimePair: Pair<Long, String>?
        get() = computeStartUptime()

    private fun computeStartUptime(): Pair<Long, String>? {
        return when {
            VERSION.SDK_INT >= VERSION_CODES.TIRAMISU -> {
                Pair(
                    Process.getStartRequestedUptimeMillis(),
                    StartUptimeMechanism.PROCESS_START_REQUESTED_UPTIME
                )
            }

            VERSION.SDK_INT >= VERSION_CODES.N -> {
                Pair(Process.getStartUptimeMillis(), StartUptimeMechanism.PROCESS_START_UPTIME)
            }

            contentProviderLoadTime != null -> {
                Pair(contentProviderLoadTime!!, StartUptimeMechanism.CONTENT_PROVIDER)
            }

            else -> {
                // This should never happen.
                Log.e("Measure", "Unable to get app start uptime")
                null
            }
        }
    }
}


/**
 * The mechanism using which the start uptime is calculated.
 */
internal object StartUptimeMechanism {
    /**
     * Measured at the time of [MeasureInitProvider] initialization.
     */
    const val CONTENT_PROVIDER = "content_provider"

    /**
     * Measured using [Process.getStartUptimeMillis].
     */
    const val PROCESS_START_UPTIME = "process_start_uptime"

    /**
     * Measured using [Process.getStartRequestedUptimeMillis].
     */
    const val PROCESS_START_REQUESTED_UPTIME = "process_start_requested_uptime"
}

/**
 * The mechanism using which the launch was marked as complete.
 */
internal object LaunchCompleteMechanism {
    const val FIRST_DRAW = "first_draw"
}
