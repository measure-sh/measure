package sh.measure.android.exporter

import sh.measure.android.events.Event
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.storage.Database
import sh.measure.android.storage.FileStorage
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.TimeProvider

/**
 * An interface for exporting an event to the server.
 */
internal interface EventExporter {
    fun <T> export(event: Event<T>)
}

/**
 * An implementation of [EventExporter] that exports an event to the server.
 *
 * Internally, this implementation creates a batch with a single event and its attachments and sends
 * it to the server.
 */
internal class EventExporterImpl(
    private val logger: Logger,
    private val database: Database,
    private val fileStorage: FileStorage,
    private val networkClient: NetworkClient,
    private val idProvider: IdProvider,
    private val timeProvider: TimeProvider,
) : EventExporter {
    override fun <T> export(event: Event<T>) {
        val batchId = idProvider.createId()
        val batchCreated =
            database.insertBatch(event.id, batchId, timeProvider.currentTimeSinceEpochInMillis)
        if (batchCreated) {
            val eventPacket = database.getEventPacket(event.id)
            val attachmentPackets = database.getAttachmentPacket(event.id)
            val exported = networkClient.execute(batchId, listOf(eventPacket), attachmentPackets)
            if (exported) {
                database.deleteEvent(event.id)
                fileStorage.deleteEventIfExist(event.id, attachmentPackets.map { it.id })
            }
        } else {
            logger.log(LogLevel.Error, "Failed to create a batch for event ${event.id}")
        }
    }
}
