package sh.measure.android.attachment

import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

/**
 * Information about an attachment. This is used to maintain a log of attachments that have been
 * captured in a session.
 */
@Serializable
internal data class AttachmentInfo(
    /**
     * The absolute path to the attachment in local storage.
     */
    val absolutePath: String,

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

    @Transient
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
)
