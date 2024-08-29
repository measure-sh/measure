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

/**
 * Represents a map of attributes that describe an event.
 *
 * Attributes can have values of type strings, booleans, integers, or doubles. To create
 * attributes, use the [buildAttributes] function.
 *
 * ```kotlin
 * val attributes = buildAttributes {
 *   "key1" to "value1"
 *   "key2" to 42
 *   "key3" to 3.14
 *   "key4" to true
 * }
 */
typealias Attributes = Map<String, AttributeValue>

/**
 * Creates a map of attributes. It provides a type-safe way to create attributes with the supported
 * value types: strings, booleans, integers, and doubles.
 *
 * Example:
 *
 * ```kotlin
 * val attributes: Attributes = buildAttributes {
 *  "key1" to "value1"
 *  "key2" to 42
 *  "key3" to 3.14
 *  "key4" to true
 * }
 */
fun buildAttributes(block: EventAttributesBuilder.() -> Unit): Attributes =
    EventAttributesBuilder().apply(block).build()

/**
 * Represents a value of an attribute. It can be a string, boolean, integer, or double.
 * To create attributes, use the [buildAttributes] function.
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
value class DoubleAttr(override val value: Double) : AttributeValue

/**
 * Builder for creating attributes. Use the [buildAttributes] function to create a set of
 * attributes.
 */
class EventAttributesBuilder {
    private val attributes = mutableMapOf<String, AttributeValue>()

    infix fun String.to(value: String) {
        attributes[this] = StringAttr(value)
    }

    infix fun String.to(value: Boolean) {
        attributes[this] = BooleanAttr(value)
    }

    infix fun String.to(value: Int) {
        attributes[this] = IntAttr(value)
    }

    infix fun String.to(value: Double) {
        attributes[this] = DoubleAttr(value)
    }

    fun build(): Attributes = attributes.toMap()
}

// This is required because we don't want to annotate AttributeValue with @Serializable as it's a
// public class. Doing so will leak the serialization implementation details to the public API.
internal fun AttributeValue.Companion.serializer(): KSerializer<@Contextual AttributeValue> {
    return AttributeValueSerializer
}

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
