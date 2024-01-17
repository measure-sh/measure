package sh.measure.android.applaunch

import android.app.Application
import sh.measure.android.events.EventTracker
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
    private val coldLaunchTrace: ColdLaunchTrace,
    private val eventTracker: EventTracker,
    private val coldLaunchListener: () -> Unit,
) : LaunchCallbacks {

    fun register() {
        logger.log(LogLevel.Debug, "Registering AppLaunchCollector")
        application.registerActivityLifecycleCallbacks(
            LaunchTracker(logger, this, timeProvider),
        )
    }

    override fun onColdLaunch(coldLaunchEvent: ColdLaunchEvent) {
        coldLaunchTrace.stop()
        val startUptime =
            coldLaunchEvent.process_start_uptime ?: coldLaunchEvent.content_provider_attach_uptime
                ?: return
        val endUptime = coldLaunchEvent.on_next_draw_uptime
        val duration = endUptime - startUptime
        logger.log(LogLevel.Debug, "cold launch duration: $duration ms, start uptime: $startUptime")
        eventTracker.trackColdLaunch(coldLaunchEvent)
        coldLaunchListener.invoke()
    }

    override fun onWarmLaunch(warmLaunchEvent: WarmLaunchEvent) {
        val startUptime = warmLaunchEvent.app_visible_uptime
        val endUptime = warmLaunchEvent.on_next_draw_uptime
        val duration = endUptime - startUptime
        logger.log(LogLevel.Debug, "warm launch duration: $duration ms, start uptime: $startUptime")
        eventTracker.trackWarmLaunchEvent(warmLaunchEvent)
    }

    override fun onHotLaunch(hotLaunchEvent: HotLaunchEvent) {
        val startUptime = hotLaunchEvent.app_visible_uptime
        val endUptime = hotLaunchEvent.on_next_draw_uptime
        val duration = endUptime - startUptime
        logger.log(LogLevel.Debug, "hot launch duration: $duration ms, start uptime: $startUptime")
        eventTracker.trackHotLaunchEvent(hotLaunchEvent)
    }
}
