package sh.measure.android.applaunch

import android.os.Process
import curtains.onNextDraw
import kotlinx.serialization.Serializable
import sh.measure.android.MeasureInitProvider

@Serializable
internal data class ColdLaunchData(
    /**
     * The start time captured using [Process.getStartElapsedRealtime].
     */
    val process_start_uptime: Long?,

    /**
     * The start time captured using [Process.getStartRequestedElapsedRealtime].
     */
    val process_start_requested_uptime: Long?,

    /**
     * The start time captured using [MeasureInitProvider.attachInfo].
     */
    val content_provider_attach_uptime: Long?,

    /**
     * The time at which the app became visible to the user. Collected using [onNextDraw].
     */
    val on_next_draw_uptime: Long,

    /**
     * The activity which drew the first frame during cold launch.
     */
    val launched_activity: String,

    /**
     * Whether the [launched_activity] was created with a saved state bundle.
     */
    val has_saved_state: Boolean,

    /**
     * The Intent data used to launch the [launched_activity].
     */
    var intent_data: String?,
)

@Serializable
internal data class WarmLaunchData(
    /**
     * The start time captured using [Process.getStartElapsedRealtime].
     */
    val process_start_uptime: Long?,

    /**
     * The start time captured using [Process.getStartRequestedElapsedRealtime].
     */
    val process_start_requested_uptime: Long?,

    /**
     * The start time captured using [MeasureInitProvider.attachInfo].
     */
    val content_provider_attach_uptime: Long?,

    /**
     * The time at which the app became visible to the user.
     */
    val app_visible_uptime: Long,

    /**
     * The time at which the app became visible to the user. Collected using [onNextDraw].
     */
    val on_next_draw_uptime: Long,

    /**
     * The activity which drew the first frame during warm launch.
     */
    val launched_activity: String,

    /**
     * Whether the [launched_activity] was created with a saved state bundle.
     */
    val has_saved_state: Boolean,

    /**
     * The Intent data used to launch the [launched_activity].
     */
    var intent_data: String?,

    /**
     * Whether the warm launch is actually a lukewarm launch.
     */
    var is_lukewarm: Boolean,
)

@Serializable
internal data class HotLaunchData(
    /**
     * The time at which the app became visible to the user.
     */
    val app_visible_uptime: Long,

    /**
     * The time at which the app became visible to the user. Collected using [onNextDraw].
     */
    val on_next_draw_uptime: Long,

    /**
     * The activity which drew the first frame during hot launch.
     */
    val launched_activity: String,

    /**
     * Whether the [launched_activity] was created with a saved state bundle.
     */
    val has_saved_state: Boolean,

    /**
     * The Intent data used to launch the [launched_activity].
     */
    var intent_data: String?,
)
