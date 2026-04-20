package sh.measure.kmp

/**
 * An attachment which can be added to an event. Represents a file that provides additional context
 * or evidence for the reported issue.
 *
 * @property name The display name of the attachment, typically including the file extension.
 * @property path The path to the file on disk.
 * @property type The type of attachment.
 */
class Attachment(
    val name: String,
    val path: String,
    val type: String,
)
