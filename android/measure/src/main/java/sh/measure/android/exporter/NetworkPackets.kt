package sh.measure.android.exporter

import android.annotation.SuppressLint
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.Serializer
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonElement
import sh.measure.android.events.EventType
import sh.measure.android.serialization.jsonSerializer

internal data class EventPacket(
    val eventId: String,
    val sessionId: String,
    val timestamp: String,
    val type: EventType,
    val userTriggered: Boolean,
    val serializedData: String?,
    val serializedDataFilePath: String?,
    val serializedAttachments: String?,
    val serializedAttributes: String,
    val serializedUserDefinedAttributes: String?,
)

@SuppressLint("UnsafeOptInUsageError")
@Serializable
internal data class SpanPacket(
    @SerialName("name")
    val name: String,
    @SerialName("trace_id")
    val traceId: String,
    @SerialName("span_id")
    val spanId: String,
    @SerialName("parent_id")
    val parentId: String?,
    @SerialName("session_id")
    val sessionId: String,
    @SerialName("start_time")
    val startTime: String,
    @SerialName("end_time")
    val endTime: String,
    @SerialName("duration")
    val duration: Long,
    @SerialName("status")
    val status: Int,
    @SerialName("attributes")
    @Serializable(with = RawJsonSerializer::class)
    val serializedAttributes: String?,
    @SerialName("user_defined_attribute")
    @Serializable(with = RawJsonSerializer::class)
    val serializedUserDefAttrs: String?,
    @SerialName("checkpoints")
    @Serializable(with = RawJsonSerializer::class)
    val serializedCheckpoints: String?,
)

@OptIn(ExperimentalSerializationApi::class)
@Serializer(String::class)
internal object RawJsonSerializer : KSerializer<String?> {
    override fun serialize(encoder: Encoder, value: String?) {
        if (value == null) {
            encoder.encodeNull()
            return
        }

        try {
            val jsonElement = jsonSerializer.parseToJsonElement(value)
            encoder.encodeSerializableValue(JsonElement.serializer(), jsonElement)
        } catch (e: Exception) {
            // If parsing fails, encode as regular string
            encoder.encodeString(value)
        }
    }

    override fun deserialize(decoder: Decoder): String? {
        if (decoder.decodeNotNullMark()) {
            val element = decoder.decodeSerializableValue(JsonElement.serializer())
            return element.toString()
        }
        return null
    }
}
