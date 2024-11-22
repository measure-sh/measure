package sh.measure.android.lifecycle

import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

internal class AppLifecycleCollector(
    private val appLifecycleManager: AppLifecycleManager,
    private val eventProcessor: EventProcessor,
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
        eventProcessor.track(
            ApplicationLifecycleData(AppLifecycleType.FOREGROUND),
            timeProvider.now(),
            EventType.LIFECYCLE_APP,
        )
    }

    override fun onAppBackground() {
        eventProcessor.track(
            ApplicationLifecycleData(AppLifecycleType.BACKGROUND),
            timeProvider.now(),
            EventType.LIFECYCLE_APP,
        )
    }
}
