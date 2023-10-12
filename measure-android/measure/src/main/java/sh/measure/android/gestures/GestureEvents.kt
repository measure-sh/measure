package sh.measure.android.gestures

import kotlinx.serialization.Serializable
import sh.measure.android.utils.iso8601Timestamp

@Serializable
internal data class ClickEvent(
    val target: String,
    val target_id: String?,
    val width: Float?,
    val height: Float?,
    val x: Float,
    val y: Float,
    val touch_down_time: String,
    val touch_up_time: String,
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
                touch_down_time = gesture.touchDownTime.iso8601Timestamp(),
                touch_up_time = gesture.touchUpTime.iso8601Timestamp()
            )
        }
    }
}

@Serializable
internal data class LongClickEvent(
    val target: String,
    val target_id: String?,
    val width: Float?,
    val height: Float?,
    val x: Float,
    val y: Float,
    val touch_down_time: String,
    val touch_up_time: String,
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
                touch_down_time = gesture.touchDownTime.iso8601Timestamp(),
                touch_up_time = gesture.touchUpTime.iso8601Timestamp()
            )
        }
    }
}

@Serializable
internal data class ScrollEvent(
    val target: String,
    val target_id: String?,
    val start_x: Float,
    val start_y: Float,
    val end_x: Float,
    val end_y: Float,
    val direction: String,
    val touch_down_time: String,
    val touch_up_time: String,
) {
    companion object {
        fun fromDetectedGesture(gesture: DetectedGesture.Scroll, target: Target): ScrollEvent {
            return ScrollEvent(
                target = target.className,
                target_id = target.id,
                start_x = gesture.startX,
                start_y = gesture.startY,
                end_x = gesture.endX,
                end_y = gesture.endY,
                touch_down_time = gesture.touchDownTime.iso8601Timestamp(),
                touch_up_time = gesture.touchUpTime.iso8601Timestamp(),
                direction = gesture.direction.name.lowercase()
            )
        }
    }
}
