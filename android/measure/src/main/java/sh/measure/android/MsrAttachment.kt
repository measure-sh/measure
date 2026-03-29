package sh.measure.android

import sh.measure.android.events.Attachment
import sh.measure.android.events.AttachmentType
import java.io.File
import java.util.UUID

/**
 * An attachment which can be added to an event. Represents a file that provides additional context
 * or evidence for the reported issue.
 *
 * @property name The display name of the attachment, typically including the file extension.
 * @property bytes The bytes containing the attachment data.
 * @property type The type of attachment. Must be one of [AttachmentType].
 */
class MsrAttachment internal constructor(
    val name: String,
    val bytes: ByteArray?,
    val path: String? = null,
    val type: String,
) {
    constructor(
        name: String,
        path: String?,
        type: String,
    ) : this(name, null, path, type)

    init {
        require(type in AttachmentType.VALID_TYPES) { "Invalid attachment type: $type" }
    }
}

internal fun MsrAttachment.toEventAttachment(attachmentType: String): Attachment {
    val id = UUID.randomUUID().toString()
    val size = bytes?.size?.toLong() ?: path?.let {
        try {
            File(it).length()
        } catch (_: Exception) {
            0L
        }
    } ?: 0L
    return Attachment(
        id = id,
        name = name,
        type = attachmentType,
        size = size,
        bytes = bytes,
        path = path,
    )
}
