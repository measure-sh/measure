package sh.measure.android.bugreport

import androidx.annotation.VisibleForTesting

/**
 * Interface defining shake detection capability
 */
internal interface ShakeDetector {
    /**
     * Start listening for shake events
     * @return true if successfully started, false otherwise
     */
    fun start(): Boolean

    /**
     * Stop listening for shake events
     */
    fun stop()

    /**
     * Set a listener to be notified of shake events
     * @param listener The listener to notify
     */
    fun setShakeListener(listener: Listener?)

    @VisibleForTesting
    fun getShakeListener(): Listener?

    interface Listener {
        fun onShake()
    }
}
