package sh.measure.android.session

import kotlinx.serialization.json.JsonElement
import java.io.File

internal data class SessionReport(
    val session_id: String,
    val timestamp: String,
    val resource: JsonElement,
    val eventsFile: File,
)
