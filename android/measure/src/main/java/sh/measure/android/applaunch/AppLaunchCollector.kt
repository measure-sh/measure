package sh.measure.android.applaunch

import android.app.Application
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.utils.TimeProvider

/**
 * Tracks cold, warm and hot launch.
 */
internal class AppLaunchCollector(
    private val application: Application,
    private val timeProvider: TimeProvider,
    private val signalProcessor: SignalProcessor,
    private val launchTracker: LaunchTracker,
) : LaunchCallbacks {
    fun register() {
        application.registerActivityLifecycleCallbacks(launchTracker)
        launchTracker.registerCallbacks(this)
    }

    fun unregister() {
        application.unregisterActivityLifecycleCallbacks(launchTracker)
        launchTracker.unregisterCallbacks()
    }

    override fun onColdLaunch(coldLaunchData: ColdLaunchData) {
        if (coldLaunchData.process_start_uptime == null && coldLaunchData.content_provider_attach_uptime == null) {
            return
        }
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.COLD_LAUNCH,
            data = coldLaunchData,
        )
    }

    override fun onWarmLaunch(warmLaunchData: WarmLaunchData) {
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.WARM_LAUNCH,
            data = warmLaunchData,
        )
    }

    override fun onHotLaunch(hotLaunchData: HotLaunchData) {
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.HOT_LAUNCH,
            data = hotLaunchData,
        )
    }
}
