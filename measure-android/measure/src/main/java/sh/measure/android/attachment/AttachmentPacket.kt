package sh.measure.android.attachment

import kotlinx.serialization.Serializable

/**
 * Attachment packet that is sent to the server.
 */
@Serializable
internal data class AttachmentPacket(
    /**
     * ISO 8601 timestamp.
     */
    val timestamp: String,
    /**
     * Name of the attachment, typically the name of the file without the extension.
     */
    val name: String,

    /**
     * Optional extension of the attachment, example: png, trace, etc.
     */
    val extension: String?,

    /**
     * The type of the attachment, [AttachmentType]
     */
    val type: String,

    /**
     * A base64 encoded string of the attachment data.
     */
    val blob: String,
)
