package sh.measure.android.applaunch

import sh.measure.android.config.ConfigProvider
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.utils.TimeProvider

/**
 * Tracks cold, warm and hot launch.
 */
internal class AppLaunchCollector(
    private val timeProvider: TimeProvider,
    private val signalProcessor: SignalProcessor,
    private val configProvider: ConfigProvider,
    private val launchTracker: LaunchTracker?,
) : LaunchCallbacks {
    fun register() {
        val preRegistrationData =
            launchTracker?.registerCallbacks(this, configProvider = configProvider)
        if (preRegistrationData?.coldLaunchData != null) {
            onColdLaunch(preRegistrationData.coldLaunchData, preRegistrationData.coldLaunchTime)
        }
        if (preRegistrationData?.warmLaunchData != null) {
            onWarmLaunch(preRegistrationData.warmLaunchData, preRegistrationData.warmLaunchTime)
        }
    }

    override fun onColdLaunch(coldLaunchData: ColdLaunchData, coldLaunchTime: Long?) {
        if (coldLaunchData.process_start_uptime == null && coldLaunchData.content_provider_attach_uptime == null) {
            return
        }
        signalProcessor.track(
            timestamp = coldLaunchTime ?: timeProvider.now(),
            type = EventType.COLD_LAUNCH,
            data = coldLaunchData,
        )
    }

    override fun onWarmLaunch(warmLaunchData: WarmLaunchData, warmLaunchTime: Long?) {
        signalProcessor.track(
            timestamp = warmLaunchTime ?: timeProvider.now(),
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
