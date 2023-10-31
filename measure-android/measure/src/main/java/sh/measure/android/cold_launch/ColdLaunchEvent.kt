package sh.measure.android.cold_launch

import android.os.Process
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import kotlinx.serialization.json.Json
import sh.measure.android.events.Event
import sh.measure.android.events.EventType

@Serializable
internal data class ColdLaunchEvent(
    /**
     * The uptime in milliseconds when the user most likely started waiting for the app to launch.
     */
    val start_uptime: Long,

    /**
     * Whether the [start_uptime] (su) is measured using [Process.getStartUptimeMillis].
     */
    val su_is_process_start_uptime: Boolean,

    /**
     * Whether the [start_uptime] (su) is measured using [Process.getStartRequestedUptimeMillis].
     */
    val su_is_process_start_requested: Boolean,

    /**
     * Whether the [start_uptime] (su) is measured using a content provider.
     */
    val su_is_content_provider_init: Boolean,

    /**
     * The uptime in milliseconds when the user likely sees the first meaningful content on the screen.
     */
    val launch_complete_uptime: Long,

    /**
     * Whether [launch_complete_uptime] is measured on first draw.
     */
    val lcu_is_first_draw: Boolean,

    /**
     * The name of the first activity that which was visible.
     */
    val first_visible_activity: String,

    /**
     * Optional intent data with which the [first_visible_activity] is launched.
     */
    val intent: String?,

    /**
     * The time taken for the app to launch in milliseconds. This is calculated
     * as [launch_complete_uptime] - [start_uptime]. Also known as TTID.
     */
    val duration: Long,

    /**
     * The timestamp when the event was created.
     */
    @Transient val timestamp: String = ""
) {
    fun toEvent(): Event {
        return Event(
            type = EventType.COLD_LAUNCH,
            timestamp = timestamp,
            data = Json.encodeToJsonElement(serializer(), this)
        )
    }
}
