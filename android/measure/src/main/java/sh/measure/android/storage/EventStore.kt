package sh.measure.android.storage

import android.database.sqlite.SQLiteException
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import sh.measure.android.appexit.AppExit
import sh.measure.android.events.Event
import sh.measure.android.events.EventType
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
import sh.measure.android.okhttp.HttpData
import sh.measure.android.utils.IdProvider
import java.io.File

internal interface EventStore {
    fun <T> store(event: Event<T>)
}

/**
 * Event store implementation that writes events to the database and file storage.
 *
 * Events with large sizes are stored in the [FileStorage] and their paths are stored in the [Database].
 * While, smaller events are serialized and stored directly in the [Database].
 *
 * All event attachments are stored in the [FileStorage] and their paths are stored in the [Database].
 */
internal class EventStoreImpl(
    private val logger: Logger,
    private val fileStorage: FileStorage,
    private val database: Database,
    private val idProvider: IdProvider,
) : EventStore {

    override fun <T> store(event: Event<T>) {
        try {
            val serializedAttributes = event.serializeAttributes()
            val serializedUserDefAttributes = event.serializeUserDefinedAttributes()
            val attachmentEntities = event.createAttachmentEntities()
            val serializedAttachments = serializeAttachmentEntities(attachmentEntities)
            val attachmentsSize = calculateAttachmentsSize(attachmentEntities)
            val serializedData = event.serializeDataToString()
            val storeEventDataInFile = event.shouldStoreEventDataInFile()
            val filePath = if (storeEventDataInFile) {
                // return from the function if writing to the file failed
                // this is to ensure that the event without data is never stored in the database
                fileStorage.writeEventData(event.id, serializedData) ?: return
            } else {
                null
            }
            val eventEntity = createEventEntity(
                event,
                serializedAttributes,
                serializedUserDefAttributes,
                attachmentEntities,
                serializedAttachments,
                attachmentsSize,
                filePath,
                serializedData,
            )
            val successfulInsert = insertEventToDatabase(eventEntity)
            if (!successfulInsert) {
                handleEventInsertionFailure(eventEntity)
            }
        } catch (e: IllegalStateException) {
            logger.log(LogLevel.Error, "Failed to serialize event: ${event.type}", e)
        }
    }

    private fun <T> Event<T>.shouldStoreEventDataInFile(): Boolean {
        return when (type) {
            EventType.EXCEPTION, EventType.ANR -> true
            EventType.HTTP -> {
                val httpEvent = data as? HttpData ?: return false
                return httpEvent.request_body != null || httpEvent.response_body != null
            }

            EventType.APP_EXIT -> {
                val appExit = data as? AppExit ?: return false
                return appExit.trace != null
            }

            else -> false
        }
    }

    private fun <T> createEventEntity(
        event: Event<T>,
        serializedAttributes: String?,
        serializedUserDefAttributes: String?,
        attachmentEntities: List<AttachmentEntity>?,
        serializedAttachments: String?,
        attachmentsSize: Long,
        filePath: String?,
        serializedData: String,
    ): EventEntity {
        if (filePath != null) {
            return EventEntity(
                id = event.id,
                sessionId = event.sessionId,
                timestamp = event.timestamp,
                type = event.type,
                attachmentEntities = attachmentEntities,
                serializedAttributes = serializedAttributes,
                attachmentsSize = attachmentsSize,
                serializedAttachments = serializedAttachments,
                filePath = filePath,
                serializedData = null,
                serializedUserDefAttributes = serializedUserDefAttributes,
                userTriggered = event.userTriggered,
            )
        } else {
            return EventEntity(
                id = event.id,
                sessionId = event.sessionId,
                timestamp = event.timestamp,
                type = event.type,
                attachmentEntities = attachmentEntities,
                serializedAttributes = serializedAttributes,
                attachmentsSize = attachmentsSize,
                serializedAttachments = serializedAttachments,
                filePath = null,
                serializedData = serializedData,
                serializedUserDefAttributes = serializedUserDefAttributes,
                userTriggered = event.userTriggered,
            )
        }
    }

    private fun insertEventToDatabase(eventEntity: EventEntity): Boolean {
        return try {
            database.insertEvent(eventEntity)
        } catch (e: SQLiteException) {
            false
        }
    }

    private fun handleEventInsertionFailure(event: EventEntity) {
        // TODO(android): handle event insertion failure for exception/ANR events
        // Event insertions typically fail due to cases we can't do much about.
        // However, given the way the SDK is setup, if the application crashes even before
        // the session can be inserted into the database, we'll miss out on capturing
        // the exception. This case needs to be handled.
        logger.log(LogLevel.Error, "Failed to insert event into database, deleting related files")
        fileStorage.deleteEventIfExist(
            event.id,
            event.attachmentEntities?.map { it.id } ?: emptyList(),
        )
    }

    private fun serializeAttachmentEntities(attachmentEntities: List<AttachmentEntity>?): String? {
        if (attachmentEntities.isNullOrEmpty()) {
            return null
        }
        return Json.encodeToString(attachmentEntities)
    }

    /**
     * Creates a list of [AttachmentEntity] from the attachments of the event.
     *
     * If the attachment has a path, it directly returns the [AttachmentEntity].
     * If the attachment has bytes, it writes the bytes to the file storage and returns the [AttachmentEntity]
     * with the path where the bytes were written to.
     */
    private fun <T> Event<T>.createAttachmentEntities(): List<AttachmentEntity>? {
        if (attachments.isEmpty()) {
            return null
        }
        val attachmentEntities = attachments.mapNotNull { attachment ->
            val id = idProvider.createId()
            when {
                attachment.path != null -> {
                    AttachmentEntity(
                        id = id,
                        path = attachment.path,
                        name = attachment.name,
                        type = attachment.type,
                    )
                }

                attachment.bytes != null -> {
                    fileStorage.writeAttachment(id, attachment.bytes)?.let { path ->
                        AttachmentEntity(
                            id = id,
                            path = path,
                            name = attachment.name,
                            type = attachment.type,
                        )
                    }
                }

                else -> {
                    logger.log(LogLevel.Error, "Attachment has no path or bytes")
                    null
                }
            }
        }
        return attachmentEntities
    }

    /**
     * Calculates the total size of all attachments, in bytes.
     */
    private fun calculateAttachmentsSize(attachmentEntities: List<AttachmentEntity>?): Long {
        fun fileSize(file: File): Long {
            return try {
                if (file.exists()) file.length() else 0
            } catch (e: SecurityException) {
                logger.log(LogLevel.Error, "Failed to calculate attachment size", e)
                0
            }
        }
        return attachmentEntities?.sumOf {
            fileStorage.getFile(it.path)?.let { file -> fileSize(file) } ?: 0
        } ?: 0
    }
}
