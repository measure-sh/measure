package sh.measure.android.gestures

import android.content.Context
import android.view.MotionEvent
import android.view.ViewConfiguration
import sh.measure.android.utils.TimeProvider
import kotlin.math.abs

internal sealed class DetectedGesture {
    internal data class Click(
        val x: Float,
        val y: Float,
        val touchDownTime: Long,
        val touchUpTime: Long,
        val timestamp: Long,
    ) : DetectedGesture()

    internal data class LongClick(
        val x: Float,
        val y: Float,
        val touchDownTime: Long,
        val touchUpTime: Long,
        val timestamp: Long,
    ) : DetectedGesture()

    internal data class Scroll(
        val x: Float,
        val y: Float,
        val endX: Float,
        val endY: Float,
        val direction: Direction,
        val touchDownTime: Long,
        val touchUpTime: Long,
        val timestamp: Long,
    ) : DetectedGesture()
}

internal enum class Direction {
    Down,
    Up,
    Right,
    Left,
}

internal object GestureDetector {
    private var startTouchX = 0f
    private var startTouchY = 0f
    private var startTouchEventTime = 0L
    private var touchSlopPx = 0

    fun detect(
        context: Context,
        motionEvent: MotionEvent,
        timeProvider: TimeProvider,
    ): DetectedGesture? {
        // Ignore multi-touch gestures, this is not supported.
        if (motionEvent.pointerCount > 1) {
            return null
        }
        if (touchSlopPx <= 0) {
            touchSlopPx = ViewConfiguration.get(context).scaledTouchSlop
        }

        if (motionEvent.action == MotionEvent.ACTION_DOWN) {
            startTouchX = motionEvent.x
            startTouchY = motionEvent.y
            startTouchEventTime = motionEvent.eventTime
        }

        if (motionEvent.action == MotionEvent.ACTION_UP) {
            val dt = motionEvent.eventTime - startTouchEventTime
            val dx = abs(startTouchX - motionEvent.x)
            val dy = abs(startTouchY - motionEvent.y)
            return if (dx <= touchSlopPx && dy <= touchSlopPx) {
                if (dt >= ViewConfiguration.getLongPressTimeout()) {
                    DetectedGesture.LongClick(
                        x = motionEvent.x,
                        y = motionEvent.y,
                        touchDownTime = startTouchEventTime,
                        touchUpTime = motionEvent.eventTime,
                        timestamp = timeProvider.now(),
                    )
                } else {
                    DetectedGesture.Click(
                        x = motionEvent.x,
                        y = motionEvent.y,
                        touchDownTime = startTouchEventTime,
                        touchUpTime = motionEvent.eventTime,
                        timestamp = timeProvider.now(),
                    )
                }
            } else {
                DetectedGesture.Scroll(
                    x = startTouchX,
                    y = startTouchY,
                    endX = motionEvent.x,
                    endY = motionEvent.y,
                    touchDownTime = startTouchEventTime,
                    touchUpTime = motionEvent.eventTime,
                    direction = calculateDirection(motionEvent, startTouchX, startTouchY),
                    timestamp = timeProvider.now(),
                )
            }
        }
        return null
    }

    private fun calculateDirection(endEvent: MotionEvent, startX: Float, startY: Float): Direction {
        val diffX = endEvent.x - startX
        val diffY = endEvent.y - startY
        return if (abs(diffX) > abs(diffY)) {
            if (diffX > 0f) {
                Direction.Right
            } else {
                Direction.Left
            }
        } else {
            if (diffY > 0) {
                Direction.Down
            } else {
                Direction.Up
            }
        }
    }
}
