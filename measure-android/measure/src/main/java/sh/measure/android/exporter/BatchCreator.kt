package sh.measure.android.exporter

import sh.measure.android.Config
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.TimeProvider

/**
 * Creates a batch of events to be exported.
 */
internal interface BatchCreator {
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

internal class BatchCreatorImpl(
    private val logger: Logger,
    private val idProvider: IdProvider,
    private val database: Database,
    private val config: Config,
    private val timeProvider: TimeProvider,
) : BatchCreator {

    override fun create(): BatchCreationResult? {
        val eventToAttachmentSizeMap =
            database.getUnBatchedEventsWithAttachmentSize(config.maxEventsBatchSize)
        if (eventToAttachmentSizeMap.isEmpty()) {
            logger.log(LogLevel.Warning, "No events to batch")
            return null
        }

        val eventIds = filterEventsForMaxAttachmentSize(eventToAttachmentSizeMap)
        if (eventIds.isEmpty()) {
            logger.log(LogLevel.Warning, "No events to batch")
            return null
        }

        val batchId = idProvider.createId()
        val batchInsertionResult = database.insertBatch(
            eventIds, batchId, timeProvider.currentTimeSinceEpochInMillis
        )
        if (!batchInsertionResult) {
            logger.log(LogLevel.Error, "Failed to insert batched event IDs")
            return null
        }
        return BatchCreationResult(
            batchId = batchId,
            eventIds = eventIds
        )
    }

    private fun filterEventsForMaxAttachmentSize(eventToAttachmentSizeMap: LinkedHashMap<String, Long>): List<String> {
        var totalSize = 0L
        return eventToAttachmentSizeMap.asSequence().takeWhile { (_, size) ->
            totalSize += size
            totalSize <= config.maxAttachmentSizeInBytes
        }.map { (key, _) -> key }.toList()
    }
}
