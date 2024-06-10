package sh.measure.android.exporter

import androidx.annotation.VisibleForTesting
import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.utils.TimeProvider
import java.util.concurrent.atomic.AtomicBoolean

internal interface PeriodicEventExporter {
    fun onAppForeground()
    fun onAppBackground()
    fun onColdLaunch()
}

/**
 * Periodic event exporter that batches events to be exported periodically. Batches are attempted
 * to be created at a fixed interval or when the app goes to the background.
 */
internal class PeriodicEventExporterImpl(
    private val logger: Logger,
    private val configProvider: ConfigProvider,
    private val executorService: MeasureExecutorService,
    private val timeProvider: TimeProvider,
    private val heartbeat: Heartbeat,
    private val eventExporter: EventExporter,
) : PeriodicEventExporter, HeartbeatListener {
    @VisibleForTesting
    internal val isExportInProgress = AtomicBoolean(false)

    @VisibleForTesting
    internal var lastBatchCreationUptimeMs = 0L

    init {
        heartbeat.addListener(this)
    }

    override fun pulse() {
        exportEvents()
    }

    override fun onAppForeground() {
        heartbeat.start(intervalMs = configProvider.eventsBatchingIntervalMs)
    }

    override fun onColdLaunch() {
        heartbeat.start(intervalMs = configProvider.eventsBatchingIntervalMs)
    }

    override fun onAppBackground() {
        heartbeat.stop()
        exportEvents()
    }

    private fun exportEvents() {
        if (!isExportInProgress.compareAndSet(false, true)) {
            logger.log(
                LogLevel.Debug,
                "Skipping export operation as another operation is in progress",
            )
            return
        }

        executorService.submit {
            try {
                processBatches()
            } finally {
                isExportInProgress.set(false)
            }
        }
    }

    private fun processBatches() {
        val batches = eventExporter.getExistingBatches()
        if (batches.isNotEmpty()) {
            processExistingBatches(batches)
        } else {
            processNewBatchIfTimeElapsed()
        }
    }

    private fun processExistingBatches(batches: LinkedHashMap<String, MutableList<String>>) {
        batches.forEach { batch ->
            eventExporter.export(batchId = batch.key, eventIds = batch.value)
        }
    }

    private fun processNewBatchIfTimeElapsed() {
        if (timeProvider.uptimeInMillis - lastBatchCreationUptimeMs >= configProvider.eventsBatchingIntervalMs) {
            eventExporter.createBatch()?.let { result ->
                lastBatchCreationUptimeMs = timeProvider.uptimeInMillis
                eventExporter.export(result.batchId, result.eventIds)
            }
        }
    }
}
