package sh.measure.android.applaunch

import android.os.Process
import curtains.onNextDraw
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import sh.measure.android.MeasureInitProvider

@Serializable
internal data class ColdLaunchEvent(
    /**
     * The start time captured using [Process.getStartUptimeMillis].
     */
    val process_start_uptime: Long?,

    /**
     * The start time captured using [Process.getStartRequestedUptimeMillis].
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
    val intent_data: String?,

    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),

    /**
     * The name of the thread on which the cold launch was measured.
     */
    @Transient val thread_name: String = "",

    /**
     * The time since epoch at which cold launch was measured.
     */
    @Transient val timestamp: Long = -1,
)

@Serializable
internal data class WarmLaunchEvent(
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
    val intent_data: String?,
    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    @Transient val thread_name: String = "",
    @Transient val timestamp: Long = -1,
)

@Serializable
internal data class HotLaunchEvent(
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
    val intent_data: String?,
    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    @Transient val thread_name: String = "",
    @Transient val timestamp: Long = -1,
)
