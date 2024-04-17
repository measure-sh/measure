package sh.measure.android.exporter

import androidx.annotation.VisibleForTesting
import sh.measure.android.Config
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.utils.IdProvider
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
    private val config: Config,
    private val idProvider: IdProvider,
    private val executorService: MeasureExecutorService,
    private val database: Database,
    private val networkClient: NetworkClient,
    private val timeProvider: TimeProvider,
    private val heartbeat: Heartbeat = HeartbeatImpl(logger, executorService),
    private val batchCreator: BatchCreator = BatchCreatorImpl(
        logger, idProvider, database, config, timeProvider
    ),
) : PeriodicEventExporter, HeartbeatListener {
    @VisibleForTesting
    internal val isExportInProgress = AtomicBoolean(false)

    @VisibleForTesting
    internal var lastBatchCreationUptimeMs = 0L

    private companion object {
        private const val MAX_UN_SYNCED_BATCHES_COUNT = 30
    }

    init {
        heartbeat.addListener(this)
    }

    override fun pulse() {
        exportEvents()
    }

    override fun onAppForeground() {
        heartbeat.start(intervalMs = config.batchingIntervalMs)
    }

    override fun onColdLaunch() {
        heartbeat.start(intervalMs = config.batchingIntervalMs)
    }

    override fun onAppBackground() {
        heartbeat.stop()
        exportEvents()
    }

    private fun exportEvents() {
        if (!isExportInProgress.compareAndSet(false, true)) {
            logger.log(
                LogLevel.Debug, "Skipping export operation as another operation is in progress"
            )
            return
        }

        try {
            val batches = database.getBatches(MAX_UN_SYNCED_BATCHES_COUNT)
            if (batches.isNotEmpty()) {
                batches.forEach { batch ->
                    val isSuccessful = exportBatch(batch.key, batch.value)
                    handleResult(isSuccessful, batch.value, batch.key)
                }
            } else {
                if (timeProvider.uptimeInMillis - lastBatchCreationUptimeMs >= config.batchingIntervalMs) {
                    batchCreator.create()?.let {
                        lastBatchCreationUptimeMs = timeProvider.uptimeInMillis
                        val isSuccessful = exportBatch(it.batchId, it.eventIds)
                        handleResult(isSuccessful, it.eventIds, it.batchId)
                    }
                }
            }
        } finally {
            isExportInProgress.set(false)
        }
    }

    private fun exportBatch(batchId: String, eventIds: List<String>): Boolean {
        val events = database.getEventPackets(eventIds)
        val attachments = database.getAttachmentPackets(eventIds)
        return networkClient.execute(batchId, events, attachments)
    }

    private fun handleResult(
        isSuccessful: Boolean, eventIds: List<String>, batchId: String
    ) {
        if (isSuccessful) {
            database.deleteEvents(eventIds)
            logger.log(LogLevel.Debug, "Successfully sent batch $batchId")
        } else {
            logger.log(LogLevel.Error, "Failed to send batch $batchId")
        }
    }
}
