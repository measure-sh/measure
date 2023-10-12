package sh.measure.android.gestures

import android.view.MotionEvent
import android.view.Window
import curtains.Curtains
import curtains.OnRootViewsChangedListener
import curtains.TouchEventInterceptor
import curtains.phoneWindow
import curtains.touchEventInterceptors

internal class WindowInterceptor {
    private val interceptors = mutableListOf<WindowTouchInterceptor>()

    fun init() {
        registerTouchEventInterceptor()
    }

    fun registerInterceptor(touchInterceptor: WindowTouchInterceptor) {
        interceptors += touchInterceptor
    }

    private fun registerTouchEventInterceptor() {
        Curtains.onRootViewsChangedListeners += OnRootViewsChangedListener { view, added ->
            if (added) {
                view.phoneWindow?.let {
                    it.touchEventInterceptors += TouchEventInterceptor { event, dispatch ->
                        val dispatchState = dispatch(event)
                        interceptors.forEach { interceptor ->
                            interceptor.intercept(event, it)
                        }
                        dispatchState
                    }
                }
            }
        }
    }

}

interface WindowTouchInterceptor {
    fun intercept(motionEvent: MotionEvent, window: Window)
}