package sh.measure.android.anr

import android.os.Handler

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
    private val mainHandler: Handler = sh.measure.android.mainHandler,
) : MainThreadProbe {
    override fun notifyWhenResponsive(callback: () -> Unit) {
        mainHandler.post(callback)
    }
}
