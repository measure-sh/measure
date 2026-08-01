package sh.measure.android.anr

import android.os.Handler
import sh.measure.android.mainHandler

/**
 * Reports when the main thread is able to run work again.
 */
internal interface MainThreadProbe {
    /**
     * Invokes [callback] once the main thread processes messages again. A stalled main
     * thread never gets there, so the callback is the signal that a stall has ended.
     */
    fun notifyWhenResponsive(callback: () -> Unit)
}

internal class HandlerMainThreadProbe(
    private val handler: Handler = mainHandler,
) : MainThreadProbe {
    override fun notifyWhenResponsive(callback: () -> Unit) {
        handler.post(callback)
    }
}
