package sh.measure.android.anr

import sh.measure.android.NativeBridge
import sh.measure.android.SigquitListener
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Listener interface for receiving ANR incidents.
 */
internal interface AnrListener {
    /**
     * Called once per stall of the main thread.
     *
     * @param timestamp the timestamp when the stall was detected.
     */
    fun onAnr(timestamp: Long)
}

/**
 * Turns raw SIGQUIT signals into ANR incidents.
 *
 * A single stalled main thread trips several system deadlines in turn, an input
 * dispatch timeout following a service or broadcast timeout. The system collects
 * stack traces for each, raising SIGQUIT every time, so one stall arrives here as a
 * stream of signals. Only the first of them is an incident.
 */
internal class AnrDetector(
    private val nativeBridge: NativeBridge,
    private val mainThreadProbe: MainThreadProbe,
    private val anrListener: AnrListener,
) : SigquitListener {

    private var isRegistered = false

    /**
     * Set from the first signal of a stall until the main thread runs again.
     */
    private val stalled = AtomicBoolean(false)

    fun register() {
        if (isRegistered) return
        nativeBridge.enableAnrReporting(listener = this)
        isRegistered = true
    }

    fun unregister() {
        if (!isRegistered) return
        nativeBridge.disableAnrReporting()
        stalled.set(false)
        isRegistered = false
    }

    override fun onSigquit(timestamp: Long) {
        if (!stalled.compareAndSet(false, true)) {
            return
        }
        // Runs only once the main thread is free again, which is what ends the stall.
        // Every signal until then belongs to the incident already reported.
        mainThreadProbe.notifyWhenResponsive { stalled.set(false) }
        anrListener.onAnr(timestamp)
    }
}
