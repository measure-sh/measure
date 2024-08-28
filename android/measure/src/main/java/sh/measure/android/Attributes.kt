package sh.measure.android

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

typealias Attributes = Map<String, AttributeValue>

sealed interface AttributeValue {
    val value: Any

    companion object
}

internal fun AttributeValue.Companion.serializer(): KSerializer<@Contextual AttributeValue> {
    return AttributeValueSerializer
}

@JvmInline
value class StringAttr(override val value: String) : AttributeValue


@JvmInline
value class BooleanAttr(override val value: Boolean) : AttributeValue

@JvmInline
value class IntAttr(override val value: Int) : AttributeValue

@JvmInline
value class DoubleAttr(override val value: Double) : AttributeValue

class EventAttributesBuilder {
    private val attributes = mutableMapOf<String, AttributeValue>()

    infix fun String.to(value: String) { attributes[this] = StringAttr(value) }
    infix fun String.to(value: Boolean) { attributes[this] = BooleanAttr(value) }
    infix fun String.to(value: Int) { attributes[this] = IntAttr(value) }
    infix fun String.to(value: Double) { attributes[this] = DoubleAttr(value) }

    fun build(): Attributes = attributes.toMap()
}

fun buildAttributes(block: EventAttributesBuilder.() -> Unit): Attributes =
    EventAttributesBuilder().apply(block).build()

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
