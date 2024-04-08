package sh.measure.android.applaunch

import android.app.Application
import sh.measure.android.events.Event
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventType
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
    private val eventProcessor: EventProcessor,
    private val coldLaunchListener: () -> Unit,
) : LaunchCallbacks {

    fun register() {
        logger.log(LogLevel.Debug, "Registering AppLaunchCollector")
        application.registerActivityLifecycleCallbacks(
            LaunchTracker(logger, this, timeProvider),
        )
    }

    override fun onColdLaunch(coldLaunchData: ColdLaunchData) {
        val startUptime =
            coldLaunchData.process_start_uptime ?: coldLaunchData.content_provider_attach_uptime
            ?: return
        val endUptime = coldLaunchData.on_next_draw_uptime
        val duration = endUptime - startUptime
        logger.log(LogLevel.Debug, "cold launch duration: $duration ms, start uptime: $startUptime")
        eventProcessor.trackColdLaunch(
            Event(
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                type = EventType.COLD_LAUNCH,
                data = coldLaunchData,
            )
        )
        coldLaunchListener.invoke()
    }

    override fun onWarmLaunch(warmLaunchData: WarmLaunchData) {
        val startUptime = warmLaunchData.app_visible_uptime
        val endUptime = warmLaunchData.on_next_draw_uptime
        val duration = endUptime - startUptime
        logger.log(LogLevel.Debug, "warm launch duration: $duration ms, start uptime: $startUptime")
        eventProcessor.trackWarmLaunch(
            Event(
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                type = EventType.WARM_LAUNCH,
                data = warmLaunchData,
            )
        )
    }

    override fun onHotLaunch(hotLaunchData: HotLaunchData) {
        val startUptime = hotLaunchData.app_visible_uptime
        val endUptime = hotLaunchData.on_next_draw_uptime
        val duration = endUptime - startUptime
        logger.log(LogLevel.Debug, "hot launch duration: $duration ms, start uptime: $startUptime")
        eventProcessor.trackHotLaunch(
            Event(
                timestamp = timeProvider.currentTimeSinceEpochInMillis,
                type = EventType.HOT_LAUNCH,
                data = hotLaunchData,
            )
        )
    }
}
