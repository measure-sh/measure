package sh.measure.android.gestures

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import sh.measure.android.events.Event
import sh.measure.android.events.EventType
import sh.measure.android.utils.iso8601Timestamp

@Serializable
internal data class Click(
    val target: String,
    val target_id: String?,
    val width: Float?,
    val height: Float?,
    val x: Float,
    val y: Float,
    val touch_down_time: Long,
    val touch_up_time: Long,
) {
    fun toEvent(): Event {
        return Event(
            timestamp = touch_up_time.iso8601Timestamp(),
            type = EventType.CLICK,
            data = Json.encodeToJsonElement(serializer(), this)
        )
    }
}

@Serializable
internal data class LongClick(
    val target: String,
    val target_id: String?,
    val width: Float?,
    val height: Float?,
    val x: Float,
    val y: Float,
    val touch_down_time: Long,
    val touch_up_time: Long,
) {
    fun toEvent(): Event {
        return Event(
            timestamp = touch_up_time.iso8601Timestamp(),
            type = EventType.LONG_CLICK,
            data = Json.encodeToJsonElement(serializer(), this)
        )
    }
}

@Serializable
internal data class Scroll(
    val target: String,
    val target_id: String?,
    val startX: Float,
    val startY: Float,
    val endX: Float,
    val endY: Float,
    val direction: String,
    val touch_down_time: Long,
    val touch_up_time: Long,
) {
    fun toEvent(): Event {
        return Event(
            timestamp = touch_up_time.iso8601Timestamp(),
            type = EventType.SCROLL,
            data = Json.encodeToJsonElement(serializer(), this)
        )
    }
}
