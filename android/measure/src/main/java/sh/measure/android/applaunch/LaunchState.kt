package sh.measure.android.applaunch

import android.os.Build
import android.os.Process

/**
 * A singleton which holds the state of the app launch. Using a singleton allows capturing
 * certain data points even if the Measure SDK has not been initialized yet.
 */
internal object LaunchState {
    var processImportanceOnInit: Int? = null
    var contentLoaderAttachElapsedRealtime: Long? = null
    var lastAppVisibleElapsedRealtime: Long? = null
    var launchTracker: LaunchTracker? = null

    val processStartElapsedRealtime: Long? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        Process.getStartElapsedRealtime()
    } else {
        null
    }

    val processStartRequestedElapsedRealtime: Long? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Process.getStartRequestedElapsedRealtime()
        } else {
            null
        }
}
