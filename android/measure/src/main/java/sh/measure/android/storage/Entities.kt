package sh.measure.android.storage

import android.annotation.SuppressLint
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import sh.measure.android.events.AttachmentType
import sh.measure.android.events.EventType
import sh.measure.android.tracing.SpanStatus

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
    val type: EventType,
    /**
     * Timestamp when the event was created.
     */
    val timestamp: String,
    /**
     * Unique identifier for the session.
     */
    val sessionId: String,
    /**
     * Whether the event was triggered by the user.
     */
    val userTriggered: Boolean,
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
     * The serialized attachments of the event. Can be null if there are no attachments.
     */
    val serializedAttachments: String? = null,
    /**
     * The serialized user defined attributes of the event.
     */
    val serializedUserDefAttributes: String?,
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
@SuppressLint("UnsafeOptInUsageError")
@Serializable
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
     * The name of the attachment. Example - "screenshot.png".
     */
    val name: String,
    /**
     * The path to the attachment.
     */
    @Transient
    val path: String = "",
)

internal data class SessionEntity(
    val sessionId: String,
    val pid: Int,
    val createdAt: Long,
    val needsReporting: Boolean = false,
    val crashed: Boolean = false,
    val supportsAppExit: Boolean,
    val appVersion: String?,
    val appBuild: String?,
    val trackJourney: Boolean?,
)

internal data class BatchEntity(
    val batchId: String,
    val eventIds: List<String>,
    val spanIds: List<String>,
    val createdAt: Long,
)

internal data class SpanEntity(
    val name: String,
    val traceId: String,
    val spanId: String,
    val parentId: String?,
    val sessionId: String,
    val startTime: Long,
    val endTime: Long,
    val duration: Long,
    val status: SpanStatus,
    val serializedAttributes: String? = null,
    val serializedUserDefinedAttrs: String? = null,
    val serializedCheckpoints: String? = null,
    val hasEnded: Boolean = true,
    val sampled: Boolean = true,
)
