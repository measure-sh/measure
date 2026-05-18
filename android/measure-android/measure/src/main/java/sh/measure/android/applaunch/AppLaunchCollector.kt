package sh.measure.android.applaunch

import android.app.Application
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.Sampler
import sh.measure.android.utils.TimeProvider

/**
 * Tracks cold, warm and hot launch.
 */
internal class AppLaunchCollector(
    private val application: Application,
    private val logger: Logger,
    private val timeProvider: TimeProvider,
    private val signalProcessor: SignalProcessor,
    private val launchTracker: LaunchTracker,
    private val sampler: Sampler,
) : LaunchCallbacks {
    private val bufferLock = Any()

    // Buffer for events until config is loaded
    // Once the config is loaded, we flush the buffer
    // and set trackEventBuffer to null
    private var trackEventBuffer: MutableList<() -> Unit>? = mutableListOf()

    fun register() {
        application.registerActivityLifecycleCallbacks(launchTracker)
        launchTracker.registerCallbacks(this)
    }

    fun unregister() {
        application.unregisterActivityLifecycleCallbacks(launchTracker)
        launchTracker.unregisterCallbacks()
    }

    fun onConfigLoaded() {
        val pending = synchronized(bufferLock) {
            trackEventBuffer?.also { trackEventBuffer = null }
        } ?: return

        if (pending.isNotEmpty()) {
            logger.log(
                LogLevel.Debug,
                "AppLaunchCollector: flushing ${pending.size} buffered launch events",
            )
            pending.forEach { it() }
        }
    }

    override fun onColdLaunch(coldLaunchData: ColdLaunchData) {
        if (coldLaunchData.process_start_uptime == null && coldLaunchData.content_provider_attach_uptime == null) {
            return
        }
        val timestamp = timeProvider.now()
        trackOrBuffer {
            signalProcessor.track(
                timestamp = timestamp,
                type = EventType.COLD_LAUNCH,
                data = coldLaunchData,
                isSampled = sampler.shouldSampleLaunchEvent(),
            )
        }
    }

    override fun onWarmLaunch(warmLaunchData: WarmLaunchData) {
        val timestamp = timeProvider.now()
        trackOrBuffer {
            signalProcessor.track(
                timestamp = timestamp,
                type = EventType.WARM_LAUNCH,
                data = warmLaunchData,
                isSampled = sampler.shouldSampleLaunchEvent(),
            )
        }
    }

    override fun onHotLaunch(hotLaunchData: HotLaunchData) {
        val timestamp = timeProvider.now()
        trackOrBuffer {
            signalProcessor.track(
                timestamp = timestamp,
                type = EventType.HOT_LAUNCH,
                data = hotLaunchData,
                isSampled = sampler.shouldSampleLaunchEvent(),
            )
        }
    }

    private fun trackOrBuffer(action: () -> Unit) {
        val shouldExecute = synchronized(bufferLock) {
            if (trackEventBuffer != null) {
                trackEventBuffer?.add(action)
                logger.log(
                    LogLevel.Debug,
                    "AppLaunchCollector: buffering launch event until config is loaded",
                )
                false
            } else {
                true
            }
        }
        if (shouldExecute) {
            action()
        }
    }
}
