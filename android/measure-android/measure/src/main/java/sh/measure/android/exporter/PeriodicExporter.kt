package sh.measure.android.exporter

import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import java.util.concurrent.Future
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit

internal interface PeriodicExporter {
    fun start()
    fun stop()
    fun setInForeground(isInForeground: Boolean)
}

internal class NoopPeriodicExporter : PeriodicExporter {
    override fun start() = Unit
    override fun stop() = Unit
    override fun setInForeground(isInForeground: Boolean) = Unit
}

internal class PeriodicExporterImpl(
    private val logger: Logger,
    private val configProvider: ConfigProvider,
    private val exporter: Exporter,
    private val scheduler: MeasureExecutorService,
) : PeriodicExporter {
    private val lock = Any()
    private var isStarted = false
    private var isInForeground = false
    private var future: Future<*>? = null

    override fun start() {
        synchronized(lock) {
            isStarted = true
            updateSchedule()
        }
    }

    override fun stop() {
        synchronized(lock) {
            isStarted = false
            updateSchedule()
        }
    }

    override fun setInForeground(isInForeground: Boolean) {
        synchronized(lock) {
            this.isInForeground = isInForeground
            updateSchedule()
        }
    }

    private fun updateSchedule() {
        val shouldRun = isStarted && isInForeground
        if (shouldRun && future == null) {
            val intervalMs = configProvider.debugExportIntervalMs
            try {
                future = scheduler.scheduleAtFixedRate(
                    { exporter.export() },
                    initialDelay = intervalMs,
                    delayMillis = intervalMs,
                    TimeUnit.MILLISECONDS,
                )
                logger.log(LogLevel.Debug, "PeriodicExporter: started with interval ${intervalMs}ms")
            } catch (e: RejectedExecutionException) {
                logger.log(LogLevel.Debug, "PeriodicExporter: failed to start", e)
            }
        } else if (!shouldRun && future != null) {
            future?.cancel(false)
            future = null
            logger.log(LogLevel.Debug, "PeriodicExporter: stopped")
        }
    }
}
