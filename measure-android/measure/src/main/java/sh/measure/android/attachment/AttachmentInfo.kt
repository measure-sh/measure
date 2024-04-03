package sh.measure.android.attachment

import kotlinx.serialization.Serializable

/**
 * Information about an attachment. This is used to maintain a log of attachments that have been
 * captured in a session.
 */
internal data class AttachmentInfo(
    /**
     * The unique identifier of the attachment.
     */
    val id: String,
    /**
     * The absolute path to the attachment in local storage.
     */
    val path: String,

    /**
     * The name of the attachment. Example: "cold_launch_trace"
     */
    val name: String,

    /**
     * The extension of the attachment if any. Example: "png", "trace"
     */
    val extension: String?,

    /**
     * The type of attachment. See [AttachmentType].
     */
    val type: String,

    /**
     * The time at which the attachment was captured, in milliseconds since epoch.
     */
    val timestamp: Long,

    /**
     * Attributes associated with the attachment.
     */
    val attributes: MutableMap<String, Any?> = mutableMapOf()
)
