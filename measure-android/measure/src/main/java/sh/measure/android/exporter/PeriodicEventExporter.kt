package sh.measure.android.exporter

import androidx.annotation.VisibleForTesting
import sh.measure.android.config.ConfigProvider
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.storage.FileStorage
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
    private val database: Database,
    private val fileStorage: FileStorage,
    private val networkClient: NetworkClient,
    private val timeProvider: TimeProvider,
    private val heartbeat: Heartbeat,
    private val batchCreator: BatchCreator,
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
        val batches = database.getBatches(MAX_UN_SYNCED_BATCHES_COUNT)
        if (batches.isNotEmpty()) {
            processExistingBatches(batches)
        } else {
            processNewBatchIfTimeElapsed()
        }
    }

    private fun processExistingBatches(batches: LinkedHashMap<String, MutableList<String>>) {
        batches.forEach { batch ->
            val events = database.getEventPackets(batch.value)
            val attachments = database.getAttachmentPackets(batch.value)
            val isSuccessful = networkClient.execute(batch.key, events, attachments)
            handleBatchProcessingResult(isSuccessful, batch.key, events, attachments)
        }
    }

    private fun processNewBatchIfTimeElapsed() {
        if (timeProvider.uptimeInMillis - lastBatchCreationUptimeMs >= configProvider.eventsBatchingIntervalMs) {
            batchCreator.create()?.let { result ->
                lastBatchCreationUptimeMs = timeProvider.uptimeInMillis
                val events = database.getEventPackets(result.eventIds)
                val attachments = database.getAttachmentPackets(result.eventIds)
                val isSuccessful = networkClient.execute(result.batchId, events, attachments)
                handleBatchProcessingResult(isSuccessful, result.batchId, events, attachments)
            }
        }
    }

    private fun handleBatchProcessingResult(
        isSuccessful: Boolean,
        batchId: String,
        events: List<EventPacket>,
        attachments: List<AttachmentPacket>,
    ) {
        if (isSuccessful) {
            val eventIds = events.map { it.eventId }
            database.deleteEvents(eventIds)
            fileStorage.deleteEventsIfExist(eventIds, attachments.map { it.id })
            logger.log(
                LogLevel.Debug,
                "Successfully sent batch $batchId",
            )
        } else {
            logger.log(LogLevel.Error, "Failed to send batch $batchId")
        }
    }
}
