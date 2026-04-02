@file:Suppress("PropertyName")

package sh.measure.android.gestures

import android.annotation.SuppressLint
import kotlinx.serialization.Serializable
import sh.measure.android.layoutinspector.LayoutElement

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class ClickData(
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
        fun fromTargetNode(
            gesture: DetectedGesture.Click,
            layoutElement: LayoutElement,
        ): ClickData = ClickData(
            target = layoutElement.label,
            target_id = layoutElement.id,
            width = layoutElement.width,
            height = layoutElement.height,
            x = gesture.x,
            y = gesture.y,
            touch_down_time = gesture.touchDownTime,
            touch_up_time = gesture.touchUpTime,
        )
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
        fun fromTargetNode(
            gesture: DetectedGesture.LongClick,
            layoutElement: LayoutElement,
        ): LongClickData = LongClickData(
            target = layoutElement.label,
            target_id = layoutElement.id,
            width = layoutElement.width,
            height = layoutElement.height,
            x = gesture.x,
            y = gesture.y,
            touch_down_time = gesture.touchDownTime,
            touch_up_time = gesture.touchUpTime,
        )
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
        fun fromTargetNode(
            gesture: DetectedGesture.Scroll,
            layoutElement: LayoutElement,
        ): ScrollData = ScrollData(
            target = layoutElement.label,
            target_id = layoutElement.id,
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
