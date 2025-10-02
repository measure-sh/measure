package sh.measure.android.gestures

import android.view.MotionEvent
import android.view.Window
import curtains.Curtains
import curtains.OnRootViewsChangedListener
import curtains.OnTouchEventListener
import curtains.phoneWindow
import curtains.touchEventInterceptors
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.layoutinspector.LayoutInspector
import sh.measure.android.layoutinspector.LayoutSnapshot
import sh.measure.android.layoutinspector.LayoutSnapshotThrottler
import sh.measure.android.layoutinspector.Node
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.RejectedExecutionException

internal interface GestureListener {
    fun onClick(clickData: ClickData)
    fun onLongClick(longClickData: LongClickData)
    fun onScroll(scrollData: ScrollData)
}

internal class GestureCollector(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val defaultExecutor: MeasureExecutorService,
    private val layoutSnapshotThrottler: LayoutSnapshotThrottler,
) {
    private var listener: GestureListener? = null
    private val touchListeners = mutableMapOf<Window, OnTouchEventListener>()
    private var rootViewsChangedListener: OnRootViewsChangedListener? = null

    fun register() {
        rootViewsChangedListener = OnRootViewsChangedListener { view, added ->
            view.phoneWindow?.let { window ->
                if (added) {
                    addTouchListenerToWindow(window)
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
        InternalTrace.trace(label = { "msr-trackGesture" }, block = {
            val gesture = GestureDetector.detect(window.context, motionEvent, timeProvider)
            if (!(gesture != null && motionEvent.action == MotionEvent.ACTION_UP)) {
                return@trace
            }
            val layoutSnapshot = try {
                getLayoutSnapshot(gesture, window, motionEvent)
            } catch (e: Exception) {
                logger.log(LogLevel.Debug, "Failed to track gesture: unable to parse layout", e)
                return@trace
            }

            if (layoutSnapshot.isEmpty()) {
                return@trace
            }

            val targetNode = findTargetNode(layoutSnapshot) ?: return@trace
            when (gesture) {
                is DetectedGesture.Click -> handleClick(
                    gesture,
                    targetNode,
                    layoutSnapshot,
                )

                is DetectedGesture.LongClick -> handleLongClick(gesture, targetNode)
                is DetectedGesture.Scroll -> handleScroll(gesture, targetNode)
            }
        })
    }

    private fun findTargetNode(layoutSnapshot: LayoutSnapshot): Node? {
        return layoutSnapshot.findTargetNode()
    }

    private fun handleClick(
        gesture: DetectedGesture.Click,
        targetNode: Node,
        layoutSnapshot: LayoutSnapshot,
    ) {
        val data = ClickData.fromTargetNode(gesture, targetNode)
        listener?.onClick(data)
        if (layoutSnapshotThrottler.shouldTakeSnapshot()) {
            trackClickWithSnapshotAsync(gesture, data, layoutSnapshot)
        } else {
            trackClick(gesture, data)
        }
    }

    private fun trackClickWithSnapshotAsync(
        gesture: DetectedGesture.Click,
        data: ClickData,
        layoutSnapshot: LayoutSnapshot,
    ) {
        val threadName = Thread.currentThread().name
        try {
            defaultExecutor.submit {
                val attachment = layoutSnapshot.toJsonAttachment()
                signalProcessor.track(
                    timestamp = gesture.timestamp,
                    type = EventType.CLICK,
                    data = data,
                    attachments = mutableListOf(attachment),
                    threadName = threadName,
                )
            }
        } catch (e: RejectedExecutionException) {
            signalProcessor.track(
                timestamp = gesture.timestamp,
                type = EventType.CLICK,
                data = data,
            )
            logger.log(LogLevel.Debug, "Failed to generate layout snapshot", e)
        }
    }

    private fun trackClick(gesture: DetectedGesture.Click, data: ClickData) {
        signalProcessor.track(timestamp = gesture.timestamp, type = EventType.CLICK, data = data)
    }

    private fun handleLongClick(gesture: DetectedGesture.LongClick, targetNode: Node) {
        val data = LongClickData.fromTargetNode(gesture, targetNode)
        listener?.onLongClick(data)
        signalProcessor.track(
            timestamp = gesture.timestamp,
            type = EventType.LONG_CLICK,
            data = data,
        )
    }

    private fun handleScroll(gesture: DetectedGesture.Scroll, targetNode: Node) {
        val data = ScrollData.fromTargetNode(gesture, targetNode)
        listener?.onScroll(data)
        signalProcessor.track(
            timestamp = gesture.timestamp,
            type = EventType.SCROLL,
            data = data,
        )
    }

    private fun getLayoutSnapshot(
        gesture: DetectedGesture,
        window: Window,
        motionEvent: MotionEvent,
    ): LayoutSnapshot {
        return LayoutInspector.capture(
            window.decorView.rootView,
            gesture,
            motionEvent,
        )
    }
}
