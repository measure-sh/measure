package sh.measure.android.gestures

import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

@Serializable
internal data class ClickEvent(
    val target: String,
    val target_id: String?,
    val width: Int?,
    val height: Int?,
    val x: Float,
    val y: Float,
    val touch_down_time: Long,
    val touch_up_time: Long,
    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    @Transient
    val timestamp: Long = -1,
    @Transient
    val thread_name: String = "",
) {
    companion object {
        fun fromDetectedGesture(gesture: DetectedGesture.Click, target: Target): ClickEvent {
            return ClickEvent(
                target = target.className,
                target_id = target.id,
                width = target.width,
                height = target.height,
                x = gesture.x,
                y = gesture.y,
                touch_down_time = gesture.touchDownTime,
                touch_up_time = gesture.touchUpTime,
                timestamp = gesture.timestamp,
                thread_name = gesture.threadName,
            )
        }
    }
}

@Serializable
internal data class LongClickEvent(
    val target: String,
    val target_id: String?,
    val width: Int?,
    val height: Int?,
    val x: Float,
    val y: Float,
    val touch_down_time: Long,
    val touch_up_time: Long,
    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    @Transient
    val timestamp: Long = -1,
    @Transient
    val thread_name: String = "",
) {
    companion object {
        fun fromDetectedGesture(gesture: DetectedGesture.LongClick, target: Target): LongClickEvent {
            return LongClickEvent(
                target = target.className,
                target_id = target.id,
                width = target.width,
                height = target.height,
                x = gesture.x,
                y = gesture.y,
                touch_down_time = gesture.touchDownTime,
                touch_up_time = gesture.touchUpTime,
                timestamp = gesture.timestamp,
                thread_name = gesture.threadName,
            )
        }
    }
}

@Serializable
internal data class ScrollEvent(
    val target: String,
    val target_id: String?,
    val x: Float,
    val y: Float,
    val end_x: Float,
    val end_y: Float,
    val direction: String,
    val touch_down_time: Long,
    val touch_up_time: Long,
    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
    @Transient
    val timestamp: Long = -1,
    @Transient
    val thread_name: String = "",
) {
    companion object {
        fun fromDetectedGesture(gesture: DetectedGesture.Scroll, target: Target): ScrollEvent {
            return ScrollEvent(
                target = target.className,
                target_id = target.id,
                x = gesture.x,
                y = gesture.y,
                end_x = gesture.endX,
                end_y = gesture.endY,
                touch_down_time = gesture.touchDownTime,
                touch_up_time = gesture.touchUpTime,
                direction = gesture.direction.name.lowercase(),
                timestamp = gesture.timestamp,
                thread_name = gesture.threadName,
            )
        }
    }
}
