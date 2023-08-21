package sh.measure.sample.context

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.Serializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonObject

@Serializable(with = AttributeValueSerializer::class)
sealed class AttributeValue {
    @Serializable
    class AttributeString(val value: String) : AttributeValue()

    @Serializable
    class AttributeInt(val value: Int) : AttributeValue()

    @Serializable
    class AttributeBoolean(val value: Boolean) : AttributeValue()

    @Serializable
    class AttributeDouble(val value: Double) : AttributeValue()

    @Serializable
    class AttributeFloat(val value: Float) : AttributeValue()

    @Serializable
    class AttributeLong(val value: Long) : AttributeValue()
}

@OptIn(ExperimentalSerializationApi::class)
@Serializer(forClass = AttributeValue::class)
object AttributeValueSerializer : KSerializer<AttributeValue> {

    override val descriptor: SerialDescriptor =
        JsonObject.serializer().descriptor

    override fun serialize(encoder: Encoder, value: AttributeValue) {
        when (value) {
            is AttributeValue.AttributeString -> encoder.encodeString(value.value)
            is AttributeValue.AttributeInt -> encoder.encodeInt(value.value)
            is AttributeValue.AttributeBoolean -> encoder.encodeBoolean(value.value)
            is AttributeValue.AttributeDouble -> encoder.encodeDouble(value.value)
            is AttributeValue.AttributeFloat -> encoder.encodeFloat(value.value)
            is AttributeValue.AttributeLong -> encoder.encodeLong(value.value)
        }
    }
}
