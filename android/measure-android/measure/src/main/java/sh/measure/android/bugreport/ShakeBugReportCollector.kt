package sh.measure.android.bugreport

import java.util.concurrent.atomic.AtomicReference

internal class ShakeBugReportCollector(
    private val shakeDetector: ShakeDetector,
) : ShakeDetector.Listener {
    private val listener = AtomicReference<MsrShakeListener?>(null)

    fun setShakeListener(listener: MsrShakeListener?) {
        this.listener.set(listener)
        if (listener == null) {
            shakeDetector.setShakeListener(null)
            shakeDetector.stop()
        } else {
            shakeDetector.setShakeListener(this)
            shakeDetector.start()
        }
    }

    override fun onShake() {
        listener.get()?.onShake()
    }
}
