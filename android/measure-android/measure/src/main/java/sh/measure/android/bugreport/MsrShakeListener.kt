package sh.measure.android.bugreport

import sh.measure.android.Measure

/**
 * Interface for notification when a shake event is detected. See [Measure.setShakeListener]
 * for details.
 */
interface MsrShakeListener {
    /**
     * Called when a shake motion is detected
     */
    fun onShake()
}
