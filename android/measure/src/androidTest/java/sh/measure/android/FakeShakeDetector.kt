package sh.measure.android

import sh.measure.android.bugreport.ShakeDetector

internal class FakeShakeDetector : ShakeDetector {
    private var listener: ShakeDetector.Listener? = null
    override fun start(): Boolean {
        return true
    }

    override fun stop() {
        // No-op
    }

    override fun setShakeListener(listener: ShakeDetector.Listener?) {
        this.listener = listener
    }

    override fun getShakeListener(): ShakeDetector.Listener? {
        return listener
    }
}
