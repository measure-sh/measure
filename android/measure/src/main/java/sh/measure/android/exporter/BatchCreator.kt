package sh.measure.android.exporter

import sh.measure.android.config.ConfigProvider
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.BatchEntity
import sh.measure.android.storage.Database
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.TimeProvider

/**
 * Creates a batch of events to be exported.
 */
internal interface BatchCreator {
    /**
     * Attempts to create a new batch of events to export.
     *
     * @param sessionId The session ID to filter events by if provided.
     * @return [Batch] if a batch was created, otherwise null.
     */
    fun create(sessionId: String? = null): Batch?
}

/**
 * Result of a batch creation operation. Contains the mapping of batch ID to all the event IDs part
 * of the batch.
 */
internal data class Batch(
    val batchId: String,
    val eventIds: List<String>,
    val spanIds: List<String>,
)

/**
 * Implementation of [BatchCreator] which creates a new batch from all available un-batched events
 * in database, keeping all configuration limits in mind. It also synchronizes batch creation by
 * ensuring only one batch can be created at a time.
 */
internal class BatchCreatorImpl(
    private val logger: Logger,
    private val idProvider: IdProvider,
    private val database: Database,
    private val configProvider: ConfigProvider,
    private val timeProvider: TimeProvider,
) : BatchCreator {
    private val batchCreationLock = Any()

    override fun create(sessionId: String?): Batch? {
        synchronized(batchCreationLock) {
            val eventToAttachmentSizeMap =
                database.getUnBatchedEventsWithAttachmentSize(
                    configProvider.maxEventsInBatch,
                    sessionId = sessionId,
                    eventTypeExportAllowList = configProvider.eventTypeExportAllowList,
                )
            if (eventToAttachmentSizeMap.isEmpty()) {
                return null
            }

            val eventIds = filterEventsForMaxAttachmentSize(eventToAttachmentSizeMap)
            val spanIds = database.getUnBatchedSpans(configProvider.maxEventsInBatch)

            if (spanIds.isEmpty() && eventIds.isEmpty()) {
                logger.log(LogLevel.Debug, "No events or spans to batch")
            }

            val batchId = idProvider.uuid()
            val batchInsertionResult = database.insertBatch(
                BatchEntity(
                    batchId = batchId,
                    eventIds = eventIds,
                    spanIds = spanIds,
                    createdAt = timeProvider.now(),
                ),
            )
            if (!batchInsertionResult) {
                logger.log(LogLevel.Debug, "Failed to insert batch")
                return null
            }
            return Batch(
                batchId = batchId,
                eventIds = eventIds,
                spanIds = spanIds,
            )
        }
    }

    private fun filterEventsForMaxAttachmentSize(eventToAttachmentSizeMap: LinkedHashMap<String, Long>): List<String> {
        var totalSize = 0L
        return eventToAttachmentSizeMap.asSequence().takeWhile { (_, size) ->
            totalSize += size
            totalSize <= configProvider.maxAttachmentSizeInEventsBatchInBytes
        }.map { (key, _) -> key }.toList()
    }
}
