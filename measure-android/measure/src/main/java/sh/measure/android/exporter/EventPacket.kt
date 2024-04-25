package sh.measure.android.exporter

internal data class EventPacket(
    val eventId: String,
    val sessionId: String,
    val timestamp: String,
    val type: String,
    val serializedData: String?,
    val serializedDataFilePath: String?,
    val serializedAttachments: String?,
    val serializedAttributes: String,
)
