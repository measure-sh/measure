package sh.measure.android.storage

import sh.measure.android.events.Attachment
import sh.measure.android.events.Event
import sh.measure.android.events.EventType
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger
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
        val serializedAttachments = event.serializeAttachments()
        val serializedAttributes = event.serializeAttributes()
        val attachmentEntities = writeAttachments(event)
        val attachmentsSize = calculateAttachmentsSize(attachmentEntities)

        when (event.type) {
            EventType.EXCEPTION, EventType.ANR -> {
                val serializedData = event.serializeDataToString()
                val path = when (event.type) {
                    EventType.EXCEPTION -> fileStorage.writeException(event.id, serializedData)
                    EventType.ANR -> fileStorage.writeAnr(event.id, serializedData)
                    else -> null
                }
                if (path != null) {
                    database.insertEvent(
                        EventEntity(
                            id = event.id,
                            sessionId = event.sessionId,
                            timestamp = event.timestamp,
                            type = event.type,
                            attachmentEntities = attachmentEntities,
                            serializedAttributes = serializedAttributes,
                            attachmentsSize = 0,
                            serializedAttachments = serializedAttachments,
                            filePath = path,
                            serializedData = null,
                        ),
                    )
                }
            }

            else -> {
                val serializedData = event.serializeDataToString()
                database.insertEvent(
                    EventEntity(
                        id = event.id,
                        sessionId = event.sessionId,
                        timestamp = event.timestamp,
                        type = event.type,
                        attachmentEntities = attachmentEntities,
                        serializedAttributes = serializedAttributes,
                        attachmentsSize = attachmentsSize,
                        serializedAttachments = serializedAttachments,
                        serializedData = serializedData,
                        filePath = null,
                    ),
                )
            }
        }
    }

    private fun <T> writeAttachments(event: Event<T>): List<AttachmentEntity>? {
        if (event.attachments.isNullOrEmpty()) {
            return null
        }
        val attachmentEntities = event.attachments.mapNotNull {
            createAttachment(it)?.let { path ->
                AttachmentEntity(
                    id = idProvider.createId(),
                    type = it.type,
                    name = it.name,
                    path = path,
                )
            }
        }
        return attachmentEntities
    }

    private fun createAttachment(attachment: Attachment): String? {
        return when {
            attachment.path != null -> {
                attachment.path
            }

            attachment.bytes != null -> {
                fileStorage.writeAttachment(idProvider.createId(), attachment.bytes)
            }

            else -> {
                logger.log(LogLevel.Error, "Attachment(${attachment.type}) has no data")
                return null
            }
        }
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
