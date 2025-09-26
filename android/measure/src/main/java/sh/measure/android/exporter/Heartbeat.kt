package sh.measure.android.exporter

import androidx.annotation.VisibleForTesting
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.Randomizer
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Future
import java.util.concurrent.RejectedExecutionException

internal interface HeartbeatListener {
    fun pulse()
}

internal interface Heartbeat {
    fun start(intervalMs: Long, jitterMs: Long)
    fun stop()
    fun addListener(listener: HeartbeatListener)
}

/**
 * Schedules a periodic pulse.
 */
internal class HeartbeatImpl(
    private val logger: Logger,
    private val scheduler: MeasureExecutorService,
    private val randomizer: Randomizer,
) : Heartbeat {
    @Volatile
    private var future: Future<*>? = null

    @VisibleForTesting
    internal val listeners = CopyOnWriteArrayList<HeartbeatListener>()

    override fun addListener(listener: HeartbeatListener) {
        listeners.add(listener)
    }

    override fun start(intervalMs: Long, jitterMs: Long) {
        if (future != null) {
            return
        }

        val randomJitterMs = randomizer.nextInt((jitterMs + 1).toInt()).toLong()
        val delayWithJitter = intervalMs + randomJitterMs
        logger.log(LogLevel.Debug, "Heartbeat starting, next pulse in ${delayWithJitter}ms")

        try {
            future = scheduler.schedule(
                {
                    listeners.forEach(HeartbeatListener::pulse)
                    scheduleNextPulse(intervalMs, jitterMs)
                },
                delayWithJitter,
            )
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Failed to start exporter heartbeat", e)
            return
        }
    }

    private fun scheduleNextPulse(intervalMs: Long, jitterMs: Long) {
        if (future?.isCancelled == true) {
            return
        }

        val randomJitterMs = randomizer.nextInt((jitterMs + 1).toInt()).toLong()
        val delayWithJitter = intervalMs + randomJitterMs
        logger.log(LogLevel.Debug, "Heartbeat scheduling next pulse in ${delayWithJitter}ms")

        try {
            future = scheduler.schedule(
                {
                    listeners.forEach(HeartbeatListener::pulse)
                    scheduleNextPulse(intervalMs, jitterMs)
                },
                delayWithJitter,
            )
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Failed to schedule next heartbeat pulse", e)
        }
    }

    override fun stop() {
        future?.cancel(false)
        future = null
    }
}
