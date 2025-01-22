package sh.measure.android.applaunch

import android.app.Application
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.TimeProvider

/**
 * Tracks cold, warm and hot launch.
 */
internal class AppLaunchCollector(
    private val logger: Logger,
    private val application: Application,
    private val timeProvider: TimeProvider,
    private val signalProcessor: SignalProcessor,
    private val launchTracker: LaunchTracker,
) : LaunchCallbacks {
    fun register() {
        logger.log(LogLevel.Debug, "Registering AppLaunchCollector")
        application.registerActivityLifecycleCallbacks(launchTracker)
        launchTracker.registerCallbacks(this)
    }

    fun unregister() {
        application.unregisterActivityLifecycleCallbacks(launchTracker)
        launchTracker.unregisterCallbacks()
    }

    override fun onColdLaunch(coldLaunchData: ColdLaunchData) {
        val startTime =
            coldLaunchData.process_start_uptime ?: coldLaunchData.content_provider_attach_uptime
                ?: return
        val endTime = coldLaunchData.on_next_draw_uptime
        val duration = endTime - startTime
        logger.log(LogLevel.Debug, "cold launch duration: $duration ms, start: $startTime")
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.COLD_LAUNCH,
            data = coldLaunchData,
        )
    }

    override fun onWarmLaunch(warmLaunchData: WarmLaunchData) {
        val startTime = warmLaunchData.app_visible_uptime
        val endTime = warmLaunchData.on_next_draw_uptime
        val duration = endTime - startTime
        logger.log(LogLevel.Debug, "warm launch duration: $duration ms, start: $startTime")
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.WARM_LAUNCH,
            data = warmLaunchData,
        )
    }

    override fun onHotLaunch(hotLaunchData: HotLaunchData) {
        val startTime = hotLaunchData.app_visible_uptime
        val endTime = hotLaunchData.on_next_draw_uptime
        val duration = endTime - startTime
        logger.log(LogLevel.Debug, "hot launch duration: $duration ms, start: $startTime")
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.HOT_LAUNCH,
            data = hotLaunchData,
        )
    }
}
