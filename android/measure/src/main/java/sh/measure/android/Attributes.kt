package sh.measure.android

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.InternalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
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

typealias Attributes = Map<String, AttributeValue>

@Serializable(with = AttributeValueSerializer::class)
sealed interface AttributeValue {
    val value: Any
}

@Serializable
@JvmInline
value class StringAttr(override val value: String) : AttributeValue

@Serializable
@JvmInline
value class BooleanAttr(override val value: Boolean) : AttributeValue

@Serializable
@JvmInline
value class IntAttr(override val value: Int) : AttributeValue

@Serializable
@JvmInline
value class DoubleAttr(override val value: Double) : AttributeValue

class EventAttributesBuilder {
    private val attributes = mutableMapOf<String, AttributeValue>()

    fun put(key: String, value: String) = apply { attributes[key] = StringAttr(value) }
    fun put(key: String, value: Boolean) = apply { attributes[key] = BooleanAttr(value) }
    fun put(key: String, value: Int) = apply { attributes[key] = IntAttr(value) }
    fun put(key: String, value: Double) = apply { attributes[key] = DoubleAttr(value) }

    fun build(): Attributes = attributes.toMap()
}

fun buildAttributes(block: EventAttributesBuilder.() -> Unit): Attributes =
    EventAttributesBuilder().apply(block).build()

object AttributeValueSerializer : KSerializer<AttributeValue> {
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
            is DoubleAttr -> JsonPrimitive(value.value)
        }
        jsonEncoder.encodeJsonElement(jsonElement)
    }

    override fun deserialize(decoder: Decoder): AttributeValue {
        val jsonDecoder = decoder as? JsonDecoder
            ?: throw SerializationException("This serializer can be used only with Json format.")
        return when (val element = jsonDecoder.decodeJsonElement()) {
            is JsonPrimitive -> when {
                element.isString -> StringAttr(element.content)
                element.booleanOrNull != null -> BooleanAttr(element.boolean)
                element.intOrNull != null -> IntAttr(element.int)
                element.doubleOrNull != null -> DoubleAttr(element.double)
                else -> throw SerializationException("Unsupported JSON primitive: $element")
            }

            else -> throw SerializationException("Unsupported JSON element: $element")
        }
    }
}
