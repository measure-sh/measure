package sh.measure.android.exporter

import androidx.annotation.VisibleForTesting
import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean

internal interface PeriodicExporter {
    fun register()
    fun resume()
    fun pause()
    fun unregister()
}

/**
 * Periodic event exporter that batches events to be exported periodically. Batches are attempted
 * to be created at a fixed interval or when the app goes to the background.
 */
internal class PeriodicExporterImpl(
    private val logger: Logger,
    private val configProvider: ConfigProvider,
    private val exportExecutor: MeasureExecutorService,
    private val timeProvider: TimeProvider,
    private val heartbeat: Heartbeat,
    private val exporter: Exporter,
) : PeriodicExporter,
    HeartbeatListener {
    @VisibleForTesting
    internal val isExportInProgress = AtomicBoolean(false)

    @VisibleForTesting
    internal var lastBatchCreationTimeMs = 0L

    init {
        heartbeat.addListener(this)
    }

    override fun pulse() {
        exportEvents()
    }

    override fun register() {
        heartbeat.start(
            intervalMs = configProvider.eventsBatchingIntervalMs,
            jitterMs = configProvider.eventsBatchingJitterMs,
        )
    }

    override fun resume() {
        heartbeat.start(
            intervalMs = configProvider.eventsBatchingIntervalMs,
            jitterMs = configProvider.eventsBatchingJitterMs,
        )
    }

    override fun unregister() {
        heartbeat.stop()
    }

    override fun pause() {
        heartbeat.stop()
        exportEvents()
    }

    private fun exportEvents() {
        if (!isExportInProgress.compareAndSet(false, true)) {
            return
        }

        try {
            exportExecutor.submit {
                try {
                    processBatches()
                } finally {
                    isExportInProgress.set(false)
                }
            }
        } catch (e: RejectedExecutionException) {
            logger.log(LogLevel.Debug, "Failed to export events", e)
            isExportInProgress.set(false)
        }
    }

    private fun processBatches() {
        val batches = exporter.getExistingBatches()
        if (batches.isNotEmpty()) {
            processExistingBatches(batches)
        } else {
            processNewBatchIfTimeElapsed()
        }
    }

    private fun processExistingBatches(batches: List<Batch>) {
        for (batch in batches) {
            val response = exporter.export(batch)
            if (response is HttpResponse.Error.RateLimitError || response is HttpResponse.Error.ServerError) {
                // stop processing the rest of the batches if one of them fails
                // this is to avoid the case where we keep trying even if the server is
                // down or we have been rate limited. We can always try again in the next heartbeat.
                break
            }
        }
    }

    private fun processNewBatchIfTimeElapsed() {
        if (timeProvider.elapsedRealtime - lastBatchCreationTimeMs >= configProvider.eventsBatchingIntervalMs) {
            exporter.createBatch()?.let { batch ->
                lastBatchCreationTimeMs = timeProvider.elapsedRealtime
                exporter.export(batch)
            }
        }
    }
}
