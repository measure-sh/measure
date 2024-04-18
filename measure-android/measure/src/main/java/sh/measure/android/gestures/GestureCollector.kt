package sh.measure.android.gestures

import android.view.MotionEvent
import android.view.ViewGroup
import android.view.Window
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.TimeProvider

internal class GestureCollector(
    private val logger: Logger,
    private val tracker: EventProcessor,
    private val timeProvider: TimeProvider,
) {
    fun register() {
        logger.log(LogLevel.Debug, "Registering gesture collector")
        WindowInterceptor().apply {
            init()
            registerInterceptor(object : WindowTouchInterceptor {
                override fun intercept(motionEvent: MotionEvent, window: Window) {
                    InternalTrace.beginSection("GestureCollector.intercept")
                    trackGesture(motionEvent, window)
                    InternalTrace.endSection()
                }
            })
        }
    }

    private fun trackGesture(motionEvent: MotionEvent, window: Window) {
        InternalTrace.beginSection("GestureCollector.trackGesture")
        val gesture = GestureDetector.detect(window.context, motionEvent, timeProvider)
        if (gesture == null || motionEvent.action != MotionEvent.ACTION_UP) {
            return
        }

        InternalTrace.beginSection("GestureCollector.getTarget")
        // Find the potential view on which the gesture ended on.
        val target = getTarget(gesture, window, motionEvent)
        if (target == null) {
            logger.log(
                LogLevel.Debug,
                "No target found for gesture ${gesture.javaClass.simpleName}",
            )
            return
        } else {
            logger.log(
                LogLevel.Debug,
                "Target found for gesture ${gesture.javaClass.simpleName}: ${target.className}:${target.id}",
            )
        }
        InternalTrace.endSection()

        InternalTrace.beginSection("GestureCollector.serializeEvent")
        when (gesture) {
            is DetectedGesture.Click -> tracker.track(
                timestamp = gesture.timestamp,
                type = EventType.CLICK,
                data = ClickData.fromDetectedGesture(gesture, target),
            )

            is DetectedGesture.LongClick -> tracker.track(
                timestamp = gesture.timestamp,
                type = EventType.LONG_CLICK,
                data = LongClickData.fromDetectedGesture(gesture, target),
            )

            is DetectedGesture.Scroll -> tracker.track(
                timestamp = gesture.timestamp,
                type = EventType.SCROLL,
                data = ScrollData.fromDetectedGesture(gesture, target),
            )
        }
        InternalTrace.endSection()
        InternalTrace.endSection()
    }

    private fun getTarget(
        gesture: DetectedGesture,
        window: Window,
        motionEvent: MotionEvent,
    ): Target? {
        return when (gesture) {
            is DetectedGesture.Scroll -> {
                GestureTargetFinder.findScrollable(
                    window.decorView as ViewGroup,
                    motionEvent,
                )
            }

            else -> {
                GestureTargetFinder.findClickable(
                    window.decorView as ViewGroup,
                    motionEvent,
                )
            }
        }
    }
}
