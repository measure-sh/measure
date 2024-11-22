package sh.measure.android.gestures

import android.view.MotionEvent
import android.view.ViewGroup
import android.view.Window
import curtains.Curtains
import curtains.OnRootViewsChangedListener
import curtains.OnTouchEventListener
import curtains.phoneWindow
import curtains.touchEventInterceptors
import curtains.windowAttachCount
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.TimeProvider

internal interface GestureListener {
    fun onClick(clickData: ClickData)
    fun onLongClick(longClickData: LongClickData)
    fun onScroll(scrollData: ScrollData)
}

internal class GestureCollector(
    private val logger: Logger,
    private val eventProcessor: EventProcessor,
    private val timeProvider: TimeProvider,
) {
    private var listener: GestureListener? = null
    private val touchListeners = mutableMapOf<Window, OnTouchEventListener>()
    private var rootViewsChangedListener: OnRootViewsChangedListener? = null

    fun register() {
        logger.log(LogLevel.Debug, "Registering gesture collector")
        rootViewsChangedListener = OnRootViewsChangedListener { view, added ->
            view.phoneWindow?.let { window ->
                if (added) {
                    if (view.windowAttachCount == 0) {
                        addTouchListenerToWindow(window)
                    }
                } else {
                    removeTouchListenerFromWindow(window)
                }
            }
        }.also { listener ->
            Curtains.onRootViewsChangedListeners += listener
        }
        Curtains.rootViews.forEach { view ->
            view.phoneWindow?.let { window ->
                addTouchListenerToWindow(window)
            }
        }
    }

    fun unregister() {
        rootViewsChangedListener?.let { listener ->
            Curtains.onRootViewsChangedListeners -= listener
        }
        rootViewsChangedListener = null
        touchListeners.forEach { (window, listener) ->
            window.touchEventInterceptors -= listener
        }
        touchListeners.clear()
    }

    private fun addTouchListenerToWindow(window: Window) {
        val touchListener = OnTouchEventListener { motionEvent ->
            trackGesture(motionEvent, window)
        }
        touchListeners[window] = touchListener
        window.touchEventInterceptors += touchListener
    }

    private fun removeTouchListenerFromWindow(window: Window) {
        touchListeners.remove(window)?.let { listener ->
            window.touchEventInterceptors -= listener
        }
    }

    private fun trackGesture(motionEvent: MotionEvent, window: Window) {
        val gesture = GestureDetector.detect(window.context, motionEvent, timeProvider)
        if (gesture == null || motionEvent.action != MotionEvent.ACTION_UP) {
            return
        }

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

        when (gesture) {
            is DetectedGesture.Click -> {
                val data = ClickData.fromDetectedGesture(gesture, target)
                listener?.onClick(data)
                eventProcessor.track(
                    timestamp = gesture.timestamp,
                    type = EventType.CLICK,
                    data = data,
                )
            }

            is DetectedGesture.LongClick -> {
                val data = LongClickData.fromDetectedGesture(gesture, target)
                listener?.onLongClick(data)
                eventProcessor.track(
                    timestamp = gesture.timestamp,
                    type = EventType.LONG_CLICK,
                    data = data,
                )
            }

            is DetectedGesture.Scroll -> {
                val data = ScrollData.fromDetectedGesture(gesture, target)
                listener?.onScroll(data)
                eventProcessor.track(
                    timestamp = gesture.timestamp,
                    type = EventType.SCROLL,
                    data = data,
                )
            }
        }
    }

    private fun getTarget(
        gesture: DetectedGesture,
        window: Window,
        motionEvent: MotionEvent,
    ): Target? {
        return when (gesture) {
            is DetectedGesture.Scroll -> {
                InternalTrace.trace(
                    label = { "msr-scroll-getTarget" },
                    block = {
                        GestureTargetFinder.findScrollable(
                            window.decorView as ViewGroup,
                            motionEvent,
                        )
                    },
                )
            }

            else -> {
                InternalTrace.trace(
                    // Note that this label is also used in [ViewTargetFinderBenchmark].
                    label = { "msr-click-getTarget" },
                    block = {
                        GestureTargetFinder.findClickable(
                            window.decorView as ViewGroup,
                            motionEvent,
                        )
                    },
                )
            }
        }
    }
}
