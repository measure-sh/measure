package sh.measure.android.utils
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Extracted from https://github.com/Kotlin/kotlinx.serialization/issues/296#issuecomment-1859572541
private fun Any?.toJsonElement(): JsonElement = when (this) {
    null -> JsonNull
    is JsonElement -> this
    is Map<*, *> -> toJsonElement()
    is Iterable<*> -> toJsonElement()
    is Boolean -> JsonPrimitive(this)
    is Number -> JsonPrimitive(this)
    is String -> JsonPrimitive(this)
    is Enum<*> -> JsonPrimitive(this.name)
    is ByteArray -> this.toList().toJsonElement()
    is CharArray -> this.toList().toJsonElement()
    is ShortArray -> this.toList().toJsonElement()
    is IntArray -> this.toList().toJsonElement()
    is LongArray -> this.toList().toJsonElement()
    is FloatArray -> this.toList().toJsonElement()
    is DoubleArray -> this.toList().toJsonElement()
    is BooleanArray -> this.toList().toJsonElement()
    is Array<*> -> toJsonElement()
    else -> error("Can't serialize unknown type: $this")
}

internal fun JsonObject.toNativeObject(): Map<String, Any?> = this.map { (key, value) -> key to value.toNativeObject() }.toMap()

internal fun Map<*, *>.toJsonElement(): JsonObject {
    val map = this.map { (key, value) ->
        key as? String ?: error("$key is not allowed as JSON key, please use a String!")
        key to value.toJsonElement()
    }
    return JsonObject(map.toMap())
}

private fun Iterable<*>.toJsonElement(): JsonArray = JsonArray(this.map { it.toJsonElement() })

private fun Array<*>.toJsonElement(): JsonArray = JsonArray(this.map { it.toJsonElement() })

private fun JsonElement.toNativeObject(): Any? = when (this) {
    JsonNull -> null
    is JsonArray -> this.map { it.toNativeObject() }
    is JsonObject -> this.toNativeObject()
    is JsonPrimitive -> if (isString) {
        content
    } else {
        content
            .toBooleanStrictOrNull()
            ?: content.toLongOrNull()
            ?: content.toDoubleOrNull()
            ?: error("Unknown primitive: $content")
    }
}
