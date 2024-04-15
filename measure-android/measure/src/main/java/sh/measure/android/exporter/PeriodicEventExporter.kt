package sh.measure.android.exporter

import androidx.annotation.VisibleForTesting
import sh.measure.android.Config
import sh.measure.android.executors.MeasureExecutorService
import sh.measure.android.logger.Logger
import sh.measure.android.storage.BatchEventEntity
import sh.measure.android.storage.Database
import sh.measure.android.utils.IdProvider
import java.util.concurrent.atomic.AtomicBoolean

internal interface PeriodicEventExporter {
    fun onAppForeground()
    fun onAppBackground()
    fun onColdLaunch()
}

/**
 * Periodic event exporter that batches events to be exported periodically. Batches are attempted
 * to be created at a fixed interval or when the app goes to the background. The periodic heartbeat
 * is active only when the app is in the foreground.
 */
internal class PeriodicEventExporterImpl(
    private val logger: Logger,
    private val config: Config,
    private val idProvider: IdProvider,
    private val executorService: MeasureExecutorService,
    private val database: Database,
    private val networkClient: NetworkClient,
    private val heartbeat: Heartbeat = HeartbeatImpl(logger, executorService)
) : PeriodicEventExporter, HeartbeatListener {
    @VisibleForTesting
    internal val isBatchingInProgress = AtomicBoolean(false)

    companion object {
        private const val MINIMUM_BATCH_SIZE = 3
    }

    init {
        heartbeat.addListener(this)
    }

    private fun createBatchAndExport() {
        if (!isBatchingInProgress.compareAndSet(false, true)) {
            // If another batching operation is in progress, skip this invocation
            // and wait for the next heartbeat. This is to prevent multiple batching operations
            // from running concurrently.
            return
        }
        val batchEventEntity = database.getEventsToBatch(config.maxEventsBatchSize)
        if (batchEventEntity.eventIdAttachmentSizeMap.isEmpty()) {
            return
        }
        if (batchEventEntity.eventIdAttachmentSizeMap.size < MINIMUM_BATCH_SIZE) {
            return
        }

        val eventIds = filterEventsForMaxAttachmentSize(batchEventEntity)
        val batchId = idProvider.createId()
        val batchInsertionResult = database.insertBatchedEventIds(eventIds, batchId)
        isBatchingInProgress.set(false)

        if (batchInsertionResult) {
            val events = database.getEventPackets(eventIds)
            val attachments = database.getAttachmentPackets(eventIds)
            enqueueExport(events, attachments)
        }
    }

    private fun enqueueExport(events: List<EventPacket>, attachments: List<AttachmentPacket>) {
        networkClient.enqueue(events, attachments)
    }

    /**
     * Filters the events to be batched based on the max attachment size limit.
     *
     * If the total size of attachments exceeds the limit, events are filtered out until the total
     * size is within the limit.
     *
     * @return List of event IDs that are within the max attachment size limit.
     */
    private fun filterEventsForMaxAttachmentSize(batchEventEntity: BatchEventEntity): List<String> {
        return if (batchEventEntity.totalAttachmentsSize > config.maxAttachmentSizeInBytes) {
            var totalSize = 0L
            batchEventEntity.eventIdAttachmentSizeMap.asSequence().takeWhile { (_, size) ->
                    totalSize += size
                    totalSize <= config.maxAttachmentSizeInBytes
                }.map { (key, _) -> key }.toList()
        } else {
            batchEventEntity.eventIdAttachmentSizeMap.keys.toList()
        }
    }

    override fun pulse() {
        createBatchAndExport()
    }

    override fun onAppForeground() {
        heartbeat.start(intervalMs = config.batchingIntervalMs)
    }

    override fun onColdLaunch() {
        heartbeat.start(intervalMs = config.batchingIntervalMs)
    }

    override fun onAppBackground() {
        heartbeat.stop()
        // Attempt to create a batch when the app goes to the background.
        createBatchAndExport()
    }
}
