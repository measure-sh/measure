package sh.measure.android.events

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.utils.iso8601Timestamp

data class Event(
    val timestamp: String,
    val type: String,
    val data: JsonElement,
)

internal fun MeasureException.toEvent(): Event {
    return Event(
        type = EventType.EXCEPTION,
        timestamp = timestamp.iso8601Timestamp(),
        data = Json.encodeToJsonElement(MeasureException.serializer(), this)
    )
}