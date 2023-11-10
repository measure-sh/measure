package sh.measure.android.app_launch

import android.os.Build
import android.os.Process

/**
 * A singleton which holds the state of the app launch.
 *
 * This information is used by [AppLaunchCollector] to calculate the cold launch time.
 */
internal object LaunchState {
    var contentLoaderAttachUptime: Long? = null
    var lastAppVisibleTime: Long? = null

    val processStartUptime: Long? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
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
