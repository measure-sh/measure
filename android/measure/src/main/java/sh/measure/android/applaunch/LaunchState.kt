package sh.measure.android.applaunch

import android.os.Build
import android.os.Process

/**
 * A singleton which holds the state of the app launch. Using a singleton allows capturing
 * certain data points even if the Measure SDK has not been initialized yet.
 *
 * This information is used by [AppLaunchCollector] to calculate the cold launch time.
 */
internal object LaunchState {
    var processImportanceOnInit: Int? = null
    var contentLoaderAttachUptime: Long? = null
    var lastAppVisibleTime: Long? = null

    val processStartUptime: Long? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        Process.getStartUptimeMillis()
    } else {
        null
    }

    val processStartRequestedUptime: Long? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Process.getStartRequestedUptimeMillis()
        } else {
            null
        }
}
