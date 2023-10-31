package sh.measure.android.events

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.encodeToStream
import okio.BufferedSink
import sh.measure.android.appexit.AppExit
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.gestures.ClickEvent
import sh.measure.android.gestures.LongClickEvent
import sh.measure.android.gestures.ScrollEvent
import sh.measure.android.utils.iso8601Timestamp

data class Event(
    val timestamp: String,
    val type: String,
    val data: JsonElement,
) {
    fun toJson(): String {
        val serializedData = Json.encodeToString(JsonElement.serializer(), data)
        return "{\"timestamp\":\"$timestamp\",\"type\":\"$type\",\"$type\":$serializedData}"
    }

    @OptIn(ExperimentalSerializationApi::class)
    fun write(sink: BufferedSink) {
        sink.writeUtf8("{")
        sink.writeUtf8("\"timestamp\":\"${timestamp}\",")
        sink.writeUtf8("\"type\":\"${type}\",")
        sink.writeUtf8("\"${type}\":")
        Json.encodeToStream(JsonElement.serializer(), data, sink.outputStream())
        sink.writeUtf8("}")
    }
}

internal fun MeasureException.toEvent(): Event {
    return Event(
        type = if (isAnr) EventType.ANR else EventType.EXCEPTION,
        timestamp = timestamp.iso8601Timestamp(),
        data = Json.encodeToJsonElement(MeasureException.serializer(), this)
    )
}

internal fun AppExit.toEvent(): Event {
    return Event(
        type = EventType.APP_EXIT,
        timestamp = timestamp,
        data = Json.encodeToJsonElement(AppExit.serializer(), this)
    )
}

internal fun ClickEvent.toEvent(): Event {
    return Event(
        timestamp = timestamp.iso8601Timestamp(),
        type = EventType.CLICK,
        data = Json.encodeToJsonElement(ClickEvent.serializer(), this)
    )
}

internal fun LongClickEvent.toEvent(): Event {
    return Event(
        timestamp = timestamp.iso8601Timestamp(),
        type = EventType.LONG_CLICK,
        data = Json.encodeToJsonElement(LongClickEvent.serializer(), this)
    )
}

internal fun ScrollEvent.toEvent(): Event {
    return Event(
        timestamp = timestamp.iso8601Timestamp(),
        type = EventType.SCROLL,
        data = Json.encodeToJsonElement(ScrollEvent.serializer(), this)
    )
}
