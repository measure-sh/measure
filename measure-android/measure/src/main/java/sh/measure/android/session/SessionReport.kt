package sh.measure.android.session

import kotlinx.serialization.json.JsonElement
import sh.measure.android.attachment.AttachmentPacket
import java.io.File

internal data class SessionReport(
    val session_id: String,
    val timestamp: String,
    val resource: JsonElement,
    val eventsFile: File,
    val attachments: List<AttachmentPacket>,
)
