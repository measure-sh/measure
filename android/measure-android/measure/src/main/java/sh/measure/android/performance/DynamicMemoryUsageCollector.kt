package sh.measure.android.performance

import androidx.annotation.VisibleForTesting
import sh.measure.android.SessionManager
import sh.measure.android.events.EventType
import sh.measure.android.events.SignalProcessor
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.lifecycle.AppLifecycleListener
import sh.measure.android.lifecycle.AppLifecycleManager
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.Sampler
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.Future
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Collects Android's Dynamic Memory Usage vital — anon_rss + swap from
 * /proc/self/status — for sessions [Sampler.shouldTrackMemoryForSession]
 * selects, every 5 seconds in the foreground and every 30 seconds in the
 * background, plus one reading on every foreground/background transition.
 *
 * Deliberately a separate collector from [MemoryUsageCollector], not an
 * extension of it: that one runs unconditionally, foreground-only, for
 * every session, and the per-session Session Replay timeline already
 * depends on it running that way. Changing its schedule or gating it behind
 * a ~0.01% sample rate would silently blank that timeline for almost every
 * session. This collector is sampled independently and keeps running in the
 * background, which the existing one deliberately does not do.
 */
internal class DynamicMemoryUsageCollector(
    private val logger: Logger,
    private val signalProcessor: SignalProcessor,
    private val timeProvider: TimeProvider,
    private val defaultExecutor: MeasureExecutorService,
    private val memoryReader: MemoryReader,
    private val sampler: Sampler,
    private val sessionManager: SessionManager,
    private val processInfo: ProcessInfoProvider,
    private val appLifecycleManager: AppLifecycleManager,
) : AppLifecycleListener {

    @VisibleForTesting
    var future: Future<*>? = null

    @VisibleForTesting
    internal var isForeground = true

    @VisibleForTesting
    internal var previousReadTimeMs = 0L

    private val isRegistered = AtomicBoolean(false)

    fun register() {
        if (isRegistered.getAndSet(true)) return
        appLifecycleManager.addListener(this)
        if (!isCurrentSessionSampled()) return
        isForeground = processInfo.isForegroundProcess()
        reschedule(if (isForeground) FOREGROUND_INTERVAL_SECONDS else BACKGROUND_INTERVAL_SECONDS)
    }

    fun unregister() {
        if (!isRegistered.getAndSet(false)) return
        appLifecycleManager.removeListener(this)
        cancel()
    }

    override fun onAppForeground() {
        isForeground = true
        if (!isCurrentSessionSampled()) {
            cancel()
            return
        }
        track()
        reschedule(FOREGROUND_INTERVAL_SECONDS)
    }

    override fun onAppBackground() {
        isForeground = false
        if (!isCurrentSessionSampled()) {
            cancel()
            return
        }
        track()
        reschedule(BACKGROUND_INTERVAL_SECONDS)
    }

    /**
     * Deliberately re-evaluated on every call rather than cached: the
     * underlying hash is a pure function of the session ID (see
     * [Sampler.shouldTrackMemoryForSession]), so recomputing it costs
     * nothing and always reflects the session that is current right now,
     * including one that started after this collector last ran.
     */
    private fun isCurrentSessionSampled(): Boolean {
        val sessionId = try {
            sessionManager.getSessionId()
        } catch (e: IllegalArgumentException) {
            return false
        }
        return sampler.shouldTrackMemoryForSession(sessionId)
    }

    private fun reschedule(intervalSeconds: Long) {
        cancel()
        future = try {
            defaultExecutor.scheduleAtFixedRate(
                { track() },
                intervalSeconds,
                intervalSeconds,
                TimeUnit.SECONDS,
            )
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Failed to schedule DynamicMemoryUsageCollector", e)
            null
        }
    }

    private fun cancel() {
        future?.cancel(false)
        future = null
    }

    private fun track() {
        val interval = getInterval()
        previousReadTimeMs = timeProvider.elapsedRealtime
        val data = MemoryUsageDynamicData(
            anon_rss = memoryReader.anonRss(),
            swap = memoryReader.swap(),
            foreground = isForeground,
            interval = interval,
        )
        signalProcessor.track(
            timestamp = timeProvider.now(),
            type = EventType.MEMORY_USAGE_DYNAMIC,
            data = data,
        )
    }

    private fun getInterval(): Long {
        val currentTime = timeProvider.elapsedRealtime
        return if (previousReadTimeMs != 0L) {
            (currentTime - previousReadTimeMs).coerceAtLeast(0)
        } else {
            0
        }
    }

    private companion object {
        const val FOREGROUND_INTERVAL_SECONDS = 5L
        const val BACKGROUND_INTERVAL_SECONDS = 30L
    }
}
