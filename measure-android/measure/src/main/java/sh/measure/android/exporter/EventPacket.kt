package sh.measure.android.exporter

internal data class EventPacket(
    val eventId: String,
    val sessionId: String,
    val timestamp: String,
    val type: String,
    val userTriggered: Boolean,
    val serializedData: String?,
    val serializedDataFilePath: String?,
    val serializedAttachments: String?,
    val serializedAttributes: String,
    val serializedUserDefinedAttributes: String?,
)

internal fun EventPacket.asFormDataPart(): String {
    require(serializedData?.isNotEmpty() == true) { "serializedData is required for converting the event packet to form data" }
    return "{\"id\":\"$eventId\",\"session_id\":\"$sessionId\",\"user_triggered\":$userTriggered,\"timestamp\":\"$timestamp\",\"type\":\"$type\",\"$type\":$serializedData,\"attachments\":$serializedAttachments,\"attribute\":$serializedAttributes}"
}
