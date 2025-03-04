package sh.measure.android.bugreport

import sh.measure.android.Measure
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

internal class ShakeBugReportCollector(
    private val autoLaunchEnabled: Boolean,
    private val shakeDetector: ShakeDetector,
) : ShakeDetector.Listener {
    private val listener = AtomicReference<MsrShakeListener?>(null)
    private val autoLaunch = AtomicBoolean(false)
    private var takeScreenshot = false

    init {
        if (autoLaunchEnabled) {
            enableAutoLaunch(takeScreenshot)
        }
    }

    fun enableAutoLaunch(takeScreenshot: Boolean) {
        autoLaunch.set(true)
        this.takeScreenshot = takeScreenshot
        shakeDetector.setShakeListener(this)
        shakeDetector.start()
    }

    fun disableAutoLaunch() {
        autoLaunch.set(false)
        shakeDetector.setShakeListener(null)
        shakeDetector.stop()
    }

    fun setShakeListener(listener: MsrShakeListener?) {
        if (autoLaunch.get()) {
            return
        }
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
        if (autoLaunch.get()) {
            Measure.launchBugReportActivity(takeScreenshot = takeScreenshot)
        } else {
            listener.get()?.onShake()
        }
    }

    fun isShakeToLaunchBugReportEnabled(): Boolean {
        return autoLaunch.get()
    }
}
