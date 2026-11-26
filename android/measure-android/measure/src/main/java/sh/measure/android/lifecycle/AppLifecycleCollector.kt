package sh.measure.android.lifecycle

import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.Attachment
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.layoutinspector.LayoutSnapshotCollector
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

internal class AppLifecycleCollector(
    private val appLifecycleManager: AppLifecycleManager,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val configProvider: ConfigProvider,
    private val layoutSnapshotCollector: LayoutSnapshotCollector,
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
        val timestamp = timeProvider.now()
        if (configProvider.layoutSnapshotScreenViewEnabled) {
            layoutSnapshotCollector.captureAttachment { attachment ->
                trackAppBackground(timestamp, attachment)
            }
        } else {
            trackAppBackground(timestamp)
        }
    }

    private fun trackAppBackground(timestamp: Long, attachment: Attachment? = null) {
        signalProcessor.track(
            ApplicationLifecycleData(AppLifecycleType.BACKGROUND),
            timestamp,
            EventType.LIFECYCLE_APP,
            attachments = listOfNotNull(attachment).toMutableList(),
        )
    }
}
