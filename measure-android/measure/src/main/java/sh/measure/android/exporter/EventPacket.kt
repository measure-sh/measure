package sh.measure.android.exporter

import sh.measure.android.storage.FileStorage

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

internal fun EventPacket.asFormDataPart(fileStorage: FileStorage): String {
    val data = serializedData ?: if (serializedDataFilePath != null) {
        fileStorage.getFile(serializedDataFilePath)?.readText()
            ?: throw IllegalStateException("No file found at path: $serializedDataFilePath")
    } else {
        throw IllegalStateException("EventPacket must have either serializedData or serializedDataFilePath")
    }
    return "{\"id\":\"$eventId\",\"session_id\":\"$sessionId\",\"user_triggered\":$userTriggered,\"timestamp\":\"$timestamp\",\"type\":\"$type\",\"$type\":$data,\"attachments\":$serializedAttachments,\"attribute\":$serializedAttributes}"
}
