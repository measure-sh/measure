package sh.measure.android.gestures

import kotlinx.serialization.Serializable

@Serializable
internal data class ClickData(
    val target: String,
    val target_id: String?,
    val width: Int?,
    val height: Int?,
    val x: Float,
    val y: Float,
    val touch_down_time: Long,
    val touch_up_time: Long,
) {
    companion object {
        fun fromDetectedGesture(gesture: DetectedGesture.Click, target: Target): ClickData {
            return ClickData(
                target = target.className,
                target_id = target.id,
                width = target.width,
                height = target.height,
                x = gesture.x,
                y = gesture.y,
                touch_down_time = gesture.touchDownTime,
                touch_up_time = gesture.touchUpTime,
            )
        }
    }
}

@Serializable
internal data class LongClickData(
    val target: String,
    val target_id: String?,
    val width: Int?,
    val height: Int?,
    val x: Float,
    val y: Float,
    val touch_down_time: Long,
    val touch_up_time: Long,
) {
    companion object {
        fun fromDetectedGesture(gesture: DetectedGesture.LongClick, target: Target): LongClickData {
            return LongClickData(
                target = target.className,
                target_id = target.id,
                width = target.width,
                height = target.height,
                x = gesture.x,
                y = gesture.y,
                touch_down_time = gesture.touchDownTime,
                touch_up_time = gesture.touchUpTime,
            )
        }
    }
}

@Serializable
internal data class ScrollData(
    val target: String,
    val target_id: String?,
    val x: Float,
    val y: Float,
    val end_x: Float,
    val end_y: Float,
    val direction: String,
    val touch_down_time: Long,
    val touch_up_time: Long,
) {
    companion object {
        fun fromDetectedGesture(gesture: DetectedGesture.Scroll, target: Target): ScrollData {
            return ScrollData(
                target = target.className,
                target_id = target.id,
                x = gesture.x,
                y = gesture.y,
                end_x = gesture.endX,
                end_y = gesture.endY,
                touch_down_time = gesture.touchDownTime,
                touch_up_time = gesture.touchUpTime,
                direction = gesture.direction.name.lowercase(),
            )
        }
    }
}
