package sh.measure.android.lifecycle

import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

internal class AppLifecycleCollector(
    private val appLifecycleManager: AppLifecycleManager,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
) : AppLifecycleListener {
    private var isRegistered = AtomicBoolean(false)

    fun register() {
        if (!isRegistered.getAndSet(true)) {
            appLifecycleManager.addListener(this)
        }
    }

    fun unregister() {
        if (isRegistered.getAndSet(false)) {
            appLifecycleManager.removeListener(this)
        }
    }

    override fun onAppForeground() {
        signalProcessor.track(
            ApplicationLifecycleData(AppLifecycleType.FOREGROUND),
            timeProvider.now(),
            EventType.LIFECYCLE_APP,
        )
    }

    override fun onAppBackground() {
        signalProcessor.track(
            ApplicationLifecycleData(AppLifecycleType.BACKGROUND),
            timeProvider.now(),
            EventType.LIFECYCLE_APP,
        )
    }
}
