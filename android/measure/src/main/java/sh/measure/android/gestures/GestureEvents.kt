package sh.measure.android.gestures

import android.annotation.SuppressLint
import kotlinx.serialization.Serializable
import sh.measure.android.layoutinspector.Node

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class ClickData(
    val target: String,
    val target_id: String?,
    val width: Int?,
    val height: Int?,
    val x: Float?,
    val y: Float?,
    val touch_down_time: Long?,
    val touch_up_time: Long?,
) {
    companion object {
        fun fromTargetNode(gesture: DetectedGesture.Click, node: Node): ClickData {
            return ClickData(
                target = node.className,
                target_id = node.id,
                width = node.width,
                height = node.height,
                x = gesture.x,
                y = gesture.y,
                touch_down_time = gesture.touchDownTime,
                touch_up_time = gesture.touchUpTime,
            )
        }
    }
}

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class LongClickData(
    val target: String,
    val target_id: String?,
    val width: Int?,
    val height: Int?,
    val x: Float,
    val y: Float,
    val touch_down_time: Long?,
    val touch_up_time: Long?,
) {
    companion object {
        fun fromTargetNode(gesture: DetectedGesture.LongClick, node: Node): LongClickData {
            return LongClickData(
                target = node.className,
                target_id = node.id,
                width = node.width,
                height = node.height,
                x = gesture.x,
                y = gesture.y,
                touch_down_time = gesture.touchDownTime,
                touch_up_time = gesture.touchUpTime,
            )
        }
    }
}

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class ScrollData(
    val target: String,
    val target_id: String?,
    val x: Float,
    val y: Float,
    val end_x: Float,
    val end_y: Float,
    val direction: String?,
    val touch_down_time: Long?,
    val touch_up_time: Long?,
) {
    companion object {
        fun fromTargetNode(gesture: DetectedGesture.Scroll, node: Node): ScrollData {
            return ScrollData(
                target = node.className,
                target_id = node.id,
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
