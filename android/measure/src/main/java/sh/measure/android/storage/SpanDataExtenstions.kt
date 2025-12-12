package sh.measure.android.storage

import kotlinx.serialization.json.JsonElement
import sh.measure.android.serialization.jsonSerializer
import sh.measure.android.tracing.Checkpoint
import sh.measure.android.tracing.SpanData
import sh.measure.android.utils.iso8601Timestamp
import sh.measure.android.utils.toJsonElement

internal fun SpanData.toSpanEntity(): SpanEntity = SpanEntity(
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
    serializedAttributes = jsonSerializer.encodeToString(
        JsonElement.serializer(),
        attributes.toJsonElement(),
    ),
    serializedUserDefinedAttrs = jsonSerializer.encodeToString(
        JsonElement.serializer(),
        userDefinedAttrs.toJsonElement(),
    ),
    hasEnded = hasEnded,
    sampled = isSampled,
)

private fun SpanData.serializeCheckpoints(): String = checkpoints.joinToString(",", prefix = "[", postfix = "]") { it.serialize() }

private fun Checkpoint.serialize(): String = "{\"name\":\"${name}\",\"timestamp\":\"${timestamp.iso8601Timestamp()}\"}"
