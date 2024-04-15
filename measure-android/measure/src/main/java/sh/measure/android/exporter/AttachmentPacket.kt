package sh.measure.android.exporter

internal data class AttachmentPacket(
    val id: String,
    val eventId: String,
    val type: String,
    val filePath: String?,
    val name: String
)
