package sh.measure.sample.context

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.modules.SerializersModule
import sh.measure.sample.context.AttributeValue.AttributeBoolean
import sh.measure.sample.context.AttributeValue.AttributeDouble
import sh.measure.sample.context.AttributeValue.AttributeFloat
import sh.measure.sample.context.AttributeValue.AttributeInt
import sh.measure.sample.context.AttributeValue.AttributeLong
import sh.measure.sample.context.AttributeValue.AttributeString

// TODO(abhay): refactor this.
//  The map should be cleared at some point. Or this will build up and become a mess.
//  It might require introducing a concept of "scope" and a new measure context would be created
//  per scope.
class MeasureContext {
    private val context = mutableMapOf<String, AttributeValue>()

    fun getJsonElement(): JsonElement? {
        if (context.isEmpty()) {
            return null
        }
        val json = Json {
            encodeDefaults = true
            serializersModule = SerializersModule {
                contextual(AttributeValue::class, AttributeValueSerializer)
            }
        }
        return json.encodeToJsonElement(context)
    }

    fun put(key: String, value: String) {
        context[key] = AttributeString(value)
    }

    fun put(key: String, value: Int) {
        context[key] = AttributeInt(value)
    }

    fun put(key: String, value: Boolean) {
        context[key] = AttributeBoolean(value)
    }

    fun put(key: String, value: Double) {
        context[key] = AttributeDouble(value)
    }

    fun put(key: String, value: Float) {
        context[key] = AttributeFloat(value)
    }

    fun put(key: String, value: Long) {
        context[key] = AttributeLong(value)
    }
}
