package sh.measure.android

import sh.measure.android.events.Attachment
import sh.measure.android.events.AttachmentType

/**
 * An attachment which can be added to an event. Represents a file that provides additional context
 * or evidence for the reported issue.
 *
 * @property name The display name of the attachment, typically including the file extension.
 * @property bytes The bytes containing the attachment data.
 * @property type The type of attachment. Must be one of [AttachmentType].
 */
class MsrAttachment internal constructor(val name: String, val bytes: ByteArray, val type: String)

internal fun MsrAttachment.toEventAttachment(attachmentType: String): Attachment {
    return Attachment(
        name = name,
        type = attachmentType,
        bytes = bytes,
    )
}
