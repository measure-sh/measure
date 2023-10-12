package sh.measure.android.gestures

import android.content.res.Resources
import android.view.MotionEvent
import android.view.View
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

            is DetectedGesture.Scroll -> tracker.trackSwipe(
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
        val view = when (gesture) {
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
        return view?.toTarget()
    }

    private fun View.toTarget(): Target? {
        val viewId = id
        val target = Target(
            className = javaClass.name,
            id = null,
            width = width.toFloat(),
            height = height.toFloat()
        )

        if (viewId == View.NO_ID || viewId <= 0 || viewId ushr 24 == 0) {
            return target
        }

        return try {
            val resources = resources ?: return null
            val packageName = when (viewId and -0x1000000) {
                0x7f000000 -> "app"
                0x01000000 -> "android"
                else -> resources.getResourcePackageName(viewId)
            }
            val typeName = resources.getResourceTypeName(viewId)
            val id = resources.getResourceEntryName(viewId)
            target.copy(
                className = "$packageName.$typeName", id = id
            )
        } catch (e: Resources.NotFoundException) {
            target
        }
    }
}

