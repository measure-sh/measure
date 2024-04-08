package sh.measure.android.storage

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

internal data class AttachmentEntity(
    val id: String,
    val type: String,
    val extension: String,
    val path: String,
)
