package sh.measure.android.session

import java.io.File

internal data class SessionReport(
    val session_id: String,
    val timestamp: String,
    val resourceFile: File,
    val eventsFile: File,
)
