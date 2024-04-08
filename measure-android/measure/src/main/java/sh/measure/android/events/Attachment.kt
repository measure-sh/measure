package sh.measure.android.events

import okio.BufferedSource

internal class Attachment(
    /**
     * The extension of the attachment, e.g. "png".
     */
    val extension: String,

    /**
     * The type of the attachment. See [AttachmentType] for the list of attachment types.
     */
    val type: String,

    /**
     * An optional byte array representing the attachment.
     */
    val bytes: ByteArray? = null,

    /**
     * An optional path to the attachment.
     */
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
}