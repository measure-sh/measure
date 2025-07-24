package sh.measure.android.exporter

import androidx.annotation.VisibleForTesting
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.storage.FileStorage
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Abstraction to run common functions for exporting of events and synchronizing different
 * exporters like [PeriodicExporter] and [ExceptionExporter].
 */
internal interface Exporter {
    fun createBatch(sessionId: String? = null): Batch?
    fun getExistingBatches(): List<Batch>

    /**
     * Exports the events and spans in a given [batch].
     *
     * @return the response of the export operation.
     */
    fun export(batch: Batch): HttpResponse?
}

internal class ExporterImpl(
    private val logger: Logger,
    private val database: Database,
    private val fileStorage: FileStorage,
    private val networkClient: NetworkClient,
    private val batchCreator: BatchCreator,
) : Exporter {
    private companion object {
        const val MAX_EXISTING_BATCHES_TO_EXPORT = 5
    }

    @VisibleForTesting
    internal val batchIdsInTransit = CopyOnWriteArrayList<String>()

    override fun export(batch: Batch): HttpResponse? {
        if (batchIdsInTransit.contains(batch.batchId)) {
            return null
        }
        batchIdsInTransit.add(batch.batchId)
        try {
            val events = database.getEventPackets(batch.eventIds)
            val spans = database.getSpanPackets(batch.spanIds)
            if (events.isEmpty() && spans.isEmpty()) {
                // shouldn't happen, but just in case it does we'd like to know.
                logger.log(
                    LogLevel.Debug,
                    "Invalid export request: no events or spans found for batch",
                )
                return null
            }
            val attachments = database.getAttachmentPackets(batch.eventIds)
            logger.log(
                LogLevel.Debug,
                "Exporting batch ${batch.batchId} with ${events.size} events and ${spans.size} spans",
            )
            val response = networkClient.execute(batch.batchId, events, attachments, spans)
            handleBatchProcessingResult(response, batch.batchId, events, spans, attachments)
            return response
        } finally {
            // always remove the batch from the list of batches in transit
            batchIdsInTransit.remove(batch.batchId)
        }
    }

    override fun createBatch(sessionId: String?): Batch? = batchCreator.create(sessionId)

    override fun getExistingBatches(): List<Batch> = database.getBatches(MAX_EXISTING_BATCHES_TO_EXPORT)

    private fun handleBatchProcessingResult(
        response: HttpResponse,
        batchId: String,
        events: List<EventPacket>,
        spans: List<SpanPacket>,
        attachments: List<AttachmentPacket>,
    ) {
        when (response) {
            is HttpResponse.Success -> {
                logger.log(LogLevel.Debug, "Successfully exported batch $batchId")
                deleteBatch(events, spans, attachments, batchId)
            }

            is HttpResponse.Error.ClientError -> {
                deleteBatch(events, spans, attachments, batchId)
                logger.log(
                    LogLevel.Debug,
                    "Failed to export batch $batchId, response code: ${response.code}",
                )
            }

            is HttpResponse.Error.ServerError -> {
                logger.log(
                    LogLevel.Debug,
                    "Failed to export batch $batchId, response code: ${response.code}",
                )
            }

            is HttpResponse.Error.UnknownError -> {
                logger.log(
                    LogLevel.Debug,
                    "Failed to export batch $batchId",
                    response.exception,
                )
            }

            else -> {
                // No-op
            }
        }
    }

    private fun deleteBatch(
        events: List<EventPacket>,
        spans: List<SpanPacket>,
        attachments: List<AttachmentPacket>,
        batchId: String,
    ) {
        val eventIds = events.map { it.eventId }
        val spanIds = spans.map { it.spanId }
        database.deleteBatch(batchId, eventIds = eventIds, spanIds = spanIds)
        fileStorage.deleteEventsIfExist(eventIds, attachments.map { it.id })
    }
}
