package sh.measure.android.appexit

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.os.Build
import androidx.annotation.RequiresApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

/**
 * Represents the data that is collected when an application exits.
 */
@Serializable
internal data class AppExit(
    /**
     * @see [ApplicationExitInfo.getReason]
     */
    @Transient
    val reasonId: Int = 0,
    /**
     * [reasonId] mapped to a human readable string.
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
     * @see [ApplicationExitInfo.getTimestamp]
     */
    @Transient
    val app_exit_time_ms: Long = 0,

    /**
     * @see [ApplicationExitInfo.getPid]
     */
    val pid: String,
) {
    @RequiresApi(Build.VERSION_CODES.R)
    fun isCrash(): Boolean = reasonId == ApplicationExitInfo.REASON_CRASH || reasonId == ApplicationExitInfo.REASON_CRASH_NATIVE || reasonId == ApplicationExitInfo.REASON_ANR
}
