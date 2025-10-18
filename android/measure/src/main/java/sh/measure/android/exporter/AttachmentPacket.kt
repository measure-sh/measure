package sh.measure.android.exporter

import sh.measure.android.events.AttachmentType

/**
 * Represents an attachment queued for upload.
 */
internal data class AttachmentPacket(
    val id: String,
    val name: String,
    val type: String,
    val path: String,
    val url: String,
    val headers: Map<String, String>,
    val expiresAt: String,
    val sessionId: String,
) {
    val contentType: String = when (type) {
        AttachmentType.LAYOUT_SNAPSHOT -> "image/svg+xml"
        AttachmentType.LAYOUT_SNAPSHOT_JSON -> "application/json"
        AttachmentType.SCREENSHOT -> {
            if (name.endsWith(".webp")) {
                "image/webp"
            } else {
                "image/jpeg"
            }
        }

        else -> "application/octet-stream"
    }

    val contentEncoding: String? = when (type) {
        AttachmentType.LAYOUT_SNAPSHOT_JSON -> "gzip"
        else -> null
    }
}
