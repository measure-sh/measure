package sh.measure.android.attributes

import kotlinx.serialization.Contextual
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.InternalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.SerialKind
import kotlinx.serialization.descriptors.buildSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.long
import kotlinx.serialization.json.longOrNull

/**
 * Represents a value of an attribute. It can be a string, boolean, integer, or double.
 */
sealed interface AttributeValue {
    val value: Any

    companion object
}

@JvmInline
value class StringAttr(override val value: String) : AttributeValue

@JvmInline
value class BooleanAttr(override val value: Boolean) : AttributeValue

@JvmInline
value class IntAttr(override val value: Int) : AttributeValue

@JvmInline
value class LongAttr(override val value: Long) : AttributeValue

@JvmInline
value class FloatAttr(override val value: Float) : AttributeValue

@JvmInline
value class DoubleAttr(override val value: Double) : AttributeValue

// This is required because we don't want to annotate AttributeValue with @Serializable as it's a
// public class. Doing so will leak the serialization implementation details to the public API.
internal fun AttributeValue.Companion.serializer(): KSerializer<@Contextual AttributeValue> = AttributeValueSerializer

internal object AttributeValueSerializer : KSerializer<AttributeValue> {
    @OptIn(InternalSerializationApi::class, ExperimentalSerializationApi::class)
    override val descriptor: SerialDescriptor =
        buildSerialDescriptor("AttributeValue", SerialKind.CONTEXTUAL)

    override fun serialize(encoder: Encoder, value: AttributeValue) {
        val jsonEncoder = encoder as? JsonEncoder
            ?: throw SerializationException("This serializer can be used only with Json format.")
        val jsonElement = when (value) {
            is StringAttr -> JsonPrimitive(value.value)
            is BooleanAttr -> JsonPrimitive(value.value)
            is IntAttr -> JsonPrimitive(value.value)
            is LongAttr -> JsonPrimitive(value.value)
            is FloatAttr -> JsonPrimitive(value.value)
            is DoubleAttr -> JsonPrimitive(value.value)
        }
        jsonEncoder.encodeJsonElement(jsonElement)
    }

    override fun deserialize(decoder: Decoder): AttributeValue {
        val jsonDecoder = decoder as? JsonDecoder
            ?: throw SerializationException("This serializer can be used only with Json format.")
        return when (val element = jsonDecoder.decodeJsonElement()) {
            is JsonPrimitive -> when {
                element.isString -> {
                    val content = element.content
                    // Try parsing as Long or Double if it's a numeric string
                    content.toLongOrNull()?.let { return LongAttr(it) }
                    content.toDoubleOrNull()?.let { return DoubleAttr(it) }
                    StringAttr(content)
                }

                element.booleanOrNull != null -> BooleanAttr(element.boolean)
                element.intOrNull != null -> IntAttr(element.int)
                element.longOrNull != null -> LongAttr(element.long)
                element.doubleOrNull != null -> DoubleAttr(element.double)
                else -> throw SerializationException("Unsupported JSON primitive: $element")
            }

            else -> throw SerializationException("Unsupported JSON element: $element")
        }
    }
}
