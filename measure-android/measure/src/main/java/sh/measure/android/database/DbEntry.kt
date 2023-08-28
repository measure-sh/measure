package sh.measure.android.database

import kotlinx.serialization.json.Json
import sh.measure.android.events.MeasureEvent

class DbEntry(
    val id: String, val type: String, val data: String, val synced: Boolean, val timestamp: Long
) {
    enum class Type {
        Event;
    }
}

internal fun MeasureEvent.toDbEntry(): DbEntry {
    return DbEntry(
        id = id,
        type = DbEntry.Type.Event.name,
        data = Json.encodeToString(MeasureEvent.serializer(), this),
        synced = false,
        timestamp = timestamp
    )
}

