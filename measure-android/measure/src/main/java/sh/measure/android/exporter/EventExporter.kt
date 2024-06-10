package sh.measure.android.exporter

import androidx.annotation.VisibleForTesting
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.storage.FileStorage
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Abstraction to run common functions for exporting of events and synchronizing different
 * exporters like [PeriodicEventExporter] and [ExceptionExporter].
 */
internal interface EventExporter {
    fun createBatch(): BatchCreationResult?
    fun getExistingBatches(): LinkedHashMap<String, MutableList<String>>
    fun export(batchId: String, eventIds: List<String>)
}

internal class EventExporterImpl(
    private val logger: Logger,
    private val database: Database,
    private val fileStorage: FileStorage,
    private val networkClient: NetworkClient,
    private val batchCreator: BatchCreator,
) : EventExporter {
    private companion object {
        const val MAX_EXISTING_BATCHES_TO_EXPORT = 30
    }

    @VisibleForTesting
    internal val batchIdsInTransit = CopyOnWriteArrayList<String>()

    override fun export(batchId: String, eventIds: List<String>) {
        if (batchIdsInTransit.contains(batchId)) {
            logger.log(LogLevel.Warning, "Batch $batchId is already in transit, skipping export")
            return
        }
        batchIdsInTransit.add(batchId)
        try {
            val events = database.getEventPackets(eventIds)
            if (events.isEmpty()) {
                // shouldn't happen, but just in case it does we'd like to know.
                logger.log(
                    LogLevel.Error,
                    "No events found for batch $batchId, invalid export request",
                )
                return
            }
            val attachments = database.getAttachmentPackets(eventIds)
            val isSuccessful = networkClient.execute(batchId, events, attachments)
            handleBatchProcessingResult(isSuccessful, batchId, events, attachments)
        } finally {
            // always remove the batch from the list of batches in transit
            batchIdsInTransit.remove(batchId)
        }
    }

    override fun createBatch(): BatchCreationResult? {
        return batchCreator.create()
    }

    override fun getExistingBatches(): LinkedHashMap<String, MutableList<String>> {
        return database.getBatches(MAX_EXISTING_BATCHES_TO_EXPORT)
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
