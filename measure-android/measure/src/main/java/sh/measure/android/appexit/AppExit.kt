package sh.measure.android.appexit

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.os.Build
import androidx.annotation.RequiresApi
import kotlinx.serialization.Serializable

/**
 * Represents the data that is collected when an application exits.
 */
@Serializable
@RequiresApi(Build.VERSION_CODES.R)
internal data class AppExit(
    /**
     * @see [ApplicationExitInfo.getReason]
     */
    val reason: String,

    /**
     * @see [ActivityManager.RunningAppProcessInfo.importance]
     */
    val importance: String,

    /**
     * @see [ApplicationExitInfo.getTraceInputStream]
     */
    val trace: String?,

    /**
     * @see [ApplicationExitInfo.getProcessName]
     */
    val process_name: String,

    /**
     * @see [ApplicationExitInfo.getPid]
     */
    val pid: String,
)
