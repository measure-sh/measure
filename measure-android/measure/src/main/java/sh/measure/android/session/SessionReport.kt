package sh.measure.android.session

import sh.measure.android.attachment.AttachmentPacket
import java.io.File

internal data class SessionReport(
    val session_id: String,
    val timestamp: String,
    val eventsFile: File,
    val attachments: List<AttachmentPacket>,
)
