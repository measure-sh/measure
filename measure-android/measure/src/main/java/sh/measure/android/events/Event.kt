package sh.measure.android.events

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.encodeToStream
import okio.BufferedSink
import sh.measure.android.app_launch.ColdLaunchEvent
import sh.measure.android.app_launch.HotLaunchEvent
import sh.measure.android.app_launch.WarmLaunchEvent
import sh.measure.android.appexit.AppExit
import sh.measure.android.exceptions.MeasureException
import sh.measure.android.gestures.ClickEvent
import sh.measure.android.gestures.LongClickEvent
import sh.measure.android.gestures.ScrollEvent
import sh.measure.android.lifecycle.ActivityLifecycleEvent
import sh.measure.android.lifecycle.ApplicationLifecycleEvent
import sh.measure.android.lifecycle.FragmentLifecycleEvent
import sh.measure.android.network_change.NetworkChangeEvent
import sh.measure.android.okhttp.HttpEvent
import sh.measure.android.performance.CpuUsage
import sh.measure.android.performance.LowMemory
import sh.measure.android.performance.MemoryUsage
import sh.measure.android.performance.TrimMemory
import sh.measure.android.utils.iso8601Timestamp

internal data class Event(
    val timestamp: String,
    val type: String,
    val data: JsonElement,
    val thread_name: String
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
        timestamp = timestamp.iso8601Timestamp(),
        data = Json.encodeToJsonElement(ColdLaunchEvent.serializer(), this),
        thread_name = thread_name
    )
}

internal fun WarmLaunchEvent.toEvent(): Event {
    return Event(
        type = EventType.WARM_LAUNCH,
        timestamp = timestamp.iso8601Timestamp(),
        data = Json.encodeToJsonElement(WarmLaunchEvent.serializer(), this),
        thread_name = thread_name
    )
}

internal fun HotLaunchEvent.toEvent(): Event {
    return Event(
        type = EventType.HOT_LAUNCH,
        timestamp = timestamp.iso8601Timestamp(),
        data = Json.encodeToJsonElement(HotLaunchEvent.serializer(), this),
        thread_name = thread_name
    )
}
internal fun NetworkChangeEvent.toEvent() : Event {
    return Event(
        type = EventType.NETWORK_CHANGE,
        timestamp = timestamp.iso8601Timestamp(),
        data = Json.encodeToJsonElement(NetworkChangeEvent.serializer(), this),
        thread_name = thread_name
    )
}

internal fun HttpEvent.toEvent(): Event {
    return Event(
        type = EventType.HTTP,
        timestamp = timestamp.iso8601Timestamp(),
        data = Json.encodeToJsonElement(HttpEvent.serializer(), this),
        thread_name = thread_name
    )
}

internal fun MemoryUsage.toEvent() : Event {
    return Event(
        type = EventType.MEMORY_USAGE,
        timestamp = timestamp.iso8601Timestamp(),
        data = Json.encodeToJsonElement(MemoryUsage.serializer(), this),
        thread_name = thread_name
    )
}

internal fun LowMemory.toEvent() : Event {
    return Event(
        type = EventType.LOW_MEMORY,
        timestamp = timestamp.iso8601Timestamp(),
        data = Json.encodeToJsonElement(LowMemory.serializer(), this),
        thread_name = thread_name
    )
}

internal fun TrimMemory.toEvent() : Event {
    return Event(
        type = EventType.TRIM_MEMORY,
        timestamp = timestamp.iso8601Timestamp(),
        data = Json.encodeToJsonElement(TrimMemory.serializer(), this),
        thread_name = thread_name
    )
}

internal fun CpuUsage.toEvent() : Event {
    return Event(
        type = EventType.CPU_USAGE,
        timestamp = timestamp.iso8601Timestamp(),
        data = Json.encodeToJsonElement(CpuUsage.serializer(), this),
        thread_name = thread_name
    )
}
