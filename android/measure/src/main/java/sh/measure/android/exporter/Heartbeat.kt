package sh.measure.android.exporter

import androidx.annotation.VisibleForTesting
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Future
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit

internal interface HeartbeatListener {
    fun pulse()
}

internal interface Heartbeat {
    fun start(intervalMs: Long, initialDelayMs: Long = 0)
    fun stop()
    fun addListener(listener: HeartbeatListener)
}

/**
 * Schedules a periodic pulse.
 */
internal class HeartbeatImpl(
    private val logger: Logger,
    private val scheduler: MeasureExecutorService,
) : Heartbeat {
    @Volatile
    private var future: Future<*>? = null

    @VisibleForTesting
    internal val listeners = CopyOnWriteArrayList<HeartbeatListener>()

    override fun addListener(listener: HeartbeatListener) {
        listeners.add(listener)
    }

    override fun start(intervalMs: Long, initialDelayMs: Long) {
        if (future != null) {
            return
        }
        try {
            future = scheduler.scheduleAtFixedRate(
                {
                    listeners.forEach(HeartbeatListener::pulse)
                },
                initialDelayMs,
                intervalMs,
                TimeUnit.MILLISECONDS,
            )
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Failed to start exporter heartbeat", e)
            return
        }
    }

    override fun stop() {
        future?.cancel(false)
        future = null
    }
}
