package sh.measure.android.events

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.encodeToStream
import okio.BufferedSink
import sh.measure.android.appexit.AppExit
import sh.measure.android.cold_launch.ColdLaunchEvent
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.gestures.ClickEvent
import sh.measure.android.gestures.LongClickEvent
import sh.measure.android.gestures.ScrollEvent
import sh.measure.android.lifecycle.ActivityLifecycleEvent
import sh.measure.android.lifecycle.ApplicationLifecycleEvent
import sh.measure.android.lifecycle.FragmentLifecycleEvent
import sh.measure.android.utils.iso8601Timestamp

data class Event(
    val timestamp: String,
    val type: String,
    val data: JsonElement,
    val thread_name: String?
) {
    fun toJson(): String {
        val serializedData = Json.encodeToString(JsonElement.serializer(), data)
        return "{\"timestamp\":\"$timestamp\",\"type\":\"$type\",\"$type\":$serializedData,\"thread_name\":\"$thread_name\"}"
    }

    @OptIn(ExperimentalSerializationApi::class)
    fun write(sink: BufferedSink) {
        sink.writeUtf8("{")
        sink.writeUtf8("\"timestamp\":\"${timestamp}\",")
        sink.writeUtf8("\"type\":\"${type}\",")
        sink.writeUtf8("\"${type}\":")
        Json.encodeToStream(JsonElement.serializer(), data, sink.outputStream())
        sink.writeUtf8(",")
        sink.writeUtf8("\"thread_name\":\"${thread_name}\"")
        sink.writeUtf8("}")
    }
}

internal fun MeasureException.toEvent(): Event {
    return Event(
        type = if (isAnr) EventType.ANR else EventType.EXCEPTION,
        timestamp = timestamp.iso8601Timestamp(),
        data = Json.encodeToJsonElement(MeasureException.serializer(), this),
        thread_name = thread_name
    )
}

internal fun AppExit.toEvent(): Event {
    return Event(
        type = EventType.APP_EXIT,
        timestamp = timestamp,
        data = Json.encodeToJsonElement(AppExit.serializer(), this),
        thread_name = thread_name
    )
}

internal fun ClickEvent.toEvent(): Event {
    return Event(
        timestamp = timestamp.iso8601Timestamp(),
        type = EventType.CLICK,
        data = Json.encodeToJsonElement(ClickEvent.serializer(), this),
        thread_name = thread_name
    )
}

internal fun LongClickEvent.toEvent(): Event {
    return Event(
        timestamp = timestamp.iso8601Timestamp(),
        type = EventType.LONG_CLICK,
        data = Json.encodeToJsonElement(LongClickEvent.serializer(), this),
        thread_name = thread_name
    )
}

internal fun ScrollEvent.toEvent(): Event {
    return Event(
        timestamp = timestamp.iso8601Timestamp(),
        type = EventType.SCROLL,
        data = Json.encodeToJsonElement(ScrollEvent.serializer(), this),
        thread_name = thread_name
    )
}

internal fun ApplicationLifecycleEvent.toEvent(): Event {
    return Event(
        type = EventType.LIFECYCLE_APP,
        timestamp = timestamp,
        data = Json.encodeToJsonElement(ApplicationLifecycleEvent.serializer(), this),
        thread_name = thread_name
    )
}

internal fun ActivityLifecycleEvent.toEvent(): Event {
    return Event(
        type = EventType.LIFECYCLE_ACTIVITY,
        timestamp = timestamp,
        data = Json.encodeToJsonElement(ActivityLifecycleEvent.serializer(), this),
        thread_name = thread_name
    )
}

internal fun FragmentLifecycleEvent.toEvent(): Event {
    return Event(
        type = EventType.LIFECYCLE_FRAGMENT,
        timestamp = timestamp,
        data = Json.encodeToJsonElement(FragmentLifecycleEvent.serializer(), this),
        thread_name = thread_name
    )
}

internal fun ColdLaunchEvent.toEvent(): Event {
    return Event(
        type = EventType.COLD_LAUNCH,
        timestamp = timestamp,
        data = Json.encodeToJsonElement(ColdLaunchEvent.serializer(), this),
        thread_name = thread_name
    )
}