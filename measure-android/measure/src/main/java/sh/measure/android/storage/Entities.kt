package sh.measure.android.storage

/**
 * Maps an event to [EventTable] in the database.
 */
internal data class EventEntity(
    val id: String,
    val type: String,
    val timestamp: Long,
    // TODO: add session ID
    val sessionId: String = "invalid-id",
    val filePath: String? = null,
    val serializedData: String? = null
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
    val id: String,
    val path: String,
    val name: String,
    val extension: String?,
    val type: String,
    val timestamp: Long,
    // Serialized attributes of the attachment
    val serializedAttributes: String
)