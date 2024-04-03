package sh.measure.android.attachments

internal data class AttachmentInfo(
    /**
     * The name of the attachment.
     */
    val name: String,

    /**
     * The extension of the attachment.
     */
    val extension: String,

    /**
     * The type of the attachment. See [AttachmentType] for the list of types.
     */
    val type: String,

    /**
     * The timestamp of the attachment.
     */
    val timestamp: Long,

    /**
     * Additional attributes to store with the attachment.
     */
    val attributes: MutableMap<String, Any?> = mutableMapOf()
)
