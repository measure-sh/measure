package sh.measure.android.events

import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient

@Serializable
internal class Attachment(
    /**
     * The name of the attachment, e.g. "screenshot.png".
     */
    val name: String,

    /**
     * The type of the attachment. See [AttachmentType] for the list of attachment types.
     */
    val type: String,

    /**
     * An optional byte array representing the attachment.
     */
    @Transient
    val bytes: ByteArray? = null,

    /**
     * An optional path to the attachment.
     */
    @Transient
    val path: String? = null,
) {
    init {
        require(bytes != null || path != null) {
            "Failed to create Attachment. Either bytes or path must be provided"
        }

        require(bytes == null || path == null) {
            "Failed to create Attachment. Only one of bytes or path must be provided"
        }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Attachment) return false

        if (name != other.name) return false
        if (type != other.type) return false
        if (bytes != null) {
            if (other.bytes == null) return false
            if (!bytes.contentEquals(other.bytes)) return false
        } else {
            if (other.bytes != null) return false
        }
        if (path != other.path) return false

        return true
    }

    override fun hashCode(): Int {
        var result = name.hashCode()
        result = 31 * result + type.hashCode()
        result = 31 * result + (bytes?.contentHashCode() ?: 0)
        result = 31 * result + (path?.hashCode() ?: 0)
        return result
    }
}
