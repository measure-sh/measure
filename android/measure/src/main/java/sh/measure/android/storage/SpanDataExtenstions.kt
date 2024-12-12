package sh.measure.android.storage

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import sh.measure.android.tracing.Checkpoint
import sh.measure.android.tracing.SpanData
import sh.measure.android.utils.iso8601Timestamp
import sh.measure.android.utils.toJsonElement

internal fun SpanData.toSpanEntity(): SpanEntity {
    return SpanEntity(
        name = name,
        spanId = spanId,
        startTime = startTime,
        sessionId = sessionId,
        duration = duration,
        status = status,
        parentId = parentId,
        endTime = endTime,
        traceId = traceId,
        serializedCheckpoints = serializeCheckpoints(),
        serializedAttributes = Json.encodeToString(
            JsonElement.serializer(),
            attributes.toJsonElement(),
        ),
        hasEnded = hasEnded,
    )
}

private fun SpanData.serializeCheckpoints(): String {
    return checkpoints.joinToString(",", prefix = "[", postfix = "]") { it.serialize() }
}

private fun Checkpoint.serialize(): String {
    return "{\"name\":\"${name}\",\"timestamp\":\"${timestamp.iso8601Timestamp()}\"}"
}
