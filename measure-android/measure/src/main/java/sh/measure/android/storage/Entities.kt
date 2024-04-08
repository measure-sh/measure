package sh.measure.android.storage

import sh.measure.android.events.AttachmentType
/**
 * Maps an event to [EventTable] in the database.
 */
internal data class EventEntity(
    val id: String,
    val type: String,
    val timestamp: Long,
    val sessionId: String,
    val filePath: String? = null,
    val serializedData: String? = null,
    val attachmentEntities: List<AttachmentEntity>,
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
