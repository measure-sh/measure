package sh.measure.android.exporter

import sh.measure.android.config.ConfigProvider
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
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
     * @return [BatchCreationResult] if a batch was created, otherwise null.
     */
    fun create(): BatchCreationResult?
}

/**
 * Result of a batch creation operation. Contains the mapping of batch ID to all the event IDs part
 * of the batch.
 */
internal data class BatchCreationResult(
    val batchId: String,
    val eventIds: List<String>,
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

    override fun create(): BatchCreationResult? {
        synchronized(batchCreationLock) {
            val eventToAttachmentSizeMap =
                database.getUnBatchedEventsWithAttachmentSize(configProvider.maxEventsInBatch)
            if (eventToAttachmentSizeMap.isEmpty()) {
                logger.log(LogLevel.Debug, "No events to batch")
                return null
            }

            val eventIds = filterEventsForMaxAttachmentSize(eventToAttachmentSizeMap)
            if (eventIds.isEmpty()) {
                logger.log(LogLevel.Debug, "No events to batch after filtering for max attachment size")
                return null
            }

            val batchId = idProvider.createId()
            val batchInsertionResult = database.insertBatch(
                eventIds,
                batchId,
                timeProvider.currentTimeSinceEpochInMillis,
            )
            if (!batchInsertionResult) {
                logger.log(LogLevel.Error, "Failed to insert batched event IDs")
                return null
            }
            return BatchCreationResult(
                batchId = batchId,
                eventIds = eventIds,
            )
        }
    }

    private fun filterEventsForMaxAttachmentSize(eventToAttachmentSizeMap: LinkedHashMap<String, Long>): List<String> {
        var totalSize = 0L
        return eventToAttachmentSizeMap.asSequence().takeWhile { (_, size) ->
            totalSize += size
            totalSize <= configProvider.maxAttachmentSizeInEventsBatch
        }.map { (key, _) -> key }.toList()
    }
}
