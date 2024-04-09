package sh.measure.android.storage

import sh.measure.android.events.AttachmentType
import sh.measure.android.events.EventType
/**
 * Maps an event to [EventTable] in the database.
 */
internal data class EventEntity(
    /**
     * Unique identifier for the event.
     */
    val id: String,
    /**
     * Type of the event. See [EventType] for possible values.
     */
    val type: String,
    /**
     * Timestamp when the event was created.
     */
    val timestamp: Long,
    /**
     * Unique identifier for the session.
     */
    val sessionId: String,
    /**
     * Total size of all attachments in bytes.
     */
    val attachmentsSize: Long,
    /**
     * The path to the file containing the serialized data, optional.
     */
    val filePath: String? = null,
    /**
     * The serialized data of the event, optional.
     */
    val serializedData: String? = null,
    /**
     * The serialized attributes of the event.
     */
    val serializedAttributes: String? = null,
    /**
     * List of attachments associated with the event. Can be null if there are no attachments.
     */
    val attachmentEntities: List<AttachmentEntity>? = null,
) {
    init {
        require(filePath != null || serializedData != null) {
            "Failed to create EventEntity. Either filePath or serializedData must be provided"
        }

        require(filePath == null || serializedData == null) {
            "Failed to create EventEntity. Only one of filePath or serializedData must be provided"
        }
    }
}

/**
 * Maps an attachment to [AttachmentTable] in the database.
 */
internal data class AttachmentEntity(
    /**
     * Unique identifier for the attachment.
     */
    val id: String,
    /**
     * Type of the attachment. See [AttachmentType] for possible values.
     */
    val type: String,
    /**
     * The extension of the attachment, e.g. "jpg", "trace", etc.
     */
    val extension: String,
    /**
     * The path to the attachment.
     */
    val path: String,
)
