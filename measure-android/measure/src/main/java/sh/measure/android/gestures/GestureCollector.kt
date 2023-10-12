package sh.measure.android.gestures

import android.view.MotionEvent
import android.view.ViewGroup
import android.view.Window
import sh.measure.android.events.EventTracker
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

internal class GestureCollector(
    private val logger: Logger,
    private val tracker: EventTracker,
    private val windowInterceptor: WindowInterceptor
) {
    fun register() {
        logger.log(LogLevel.Debug, "Registering gesture collector")
        windowInterceptor.registerInterceptor(object : WindowTouchInterceptor {
            override fun intercept(motionEvent: MotionEvent, window: Window) {
                trackGesture(motionEvent, window)
            }
        })
    }

    private fun trackGesture(motionEvent: MotionEvent, window: Window) {
        val gesture = GestureDetector.detect(window.context, motionEvent)
        if (gesture == null || motionEvent.action != MotionEvent.ACTION_UP) {
            return
        }
        // Find the potential view on which the gesture ended on.
        val target = getTarget(gesture, window, motionEvent)
        if (target == null) {
            logger.log(
                LogLevel.Debug, "No target found for gesture ${gesture.javaClass.simpleName}"
            )
            return
        } else {
            logger.log(
                LogLevel.Debug,
                "Target found for gesture ${gesture.javaClass.simpleName}: ${target.className}:${target.id}"
            )
        }

        when (gesture) {
            is DetectedGesture.Click -> tracker.trackClick(
                Click(
                    target = target.className,
                    target_id = target.id,
                    width = target.width,
                    height = target.height,
                    x = gesture.x,
                    y = gesture.y,
                    touch_down_time = gesture.touchDownTime,
                    touch_up_time = gesture.touchUpTime
                )
            )

            is DetectedGesture.LongClick -> tracker.trackLongClick(
                LongClick(
                    target = target.className,
                    target_id = target.id,
                    width = target.width,
                    height = target.height,
                    x = gesture.x,
                    y = gesture.y,
                    touch_down_time = gesture.touchDownTime,
                    touch_up_time = gesture.touchUpTime
                )
            )

            is DetectedGesture.Scroll -> tracker.trackScroll(
                Scroll(
                    target = target.className,
                    target_id = target.id,
                    startX = gesture.startX,
                    startY = gesture.startY,
                    endX = gesture.endX,
                    endY = gesture.endY,
                    touch_down_time = gesture.touchDownTime,
                    touch_up_time = gesture.touchUpTime,
                    direction = gesture.direction.name.lowercase()
                )
            )
        }
    }

    private fun getTarget(
        gesture: DetectedGesture, window: Window, motionEvent: MotionEvent
    ): Target? {
        return when (gesture) {
            is DetectedGesture.Scroll -> {
                GestureTargetFinder.findScrollable(
                    window.decorView as ViewGroup, motionEvent
                )
            }

            else -> {
                GestureTargetFinder.findClickable(
                    window.decorView as ViewGroup, motionEvent
                )
            }
        }
    }
}

