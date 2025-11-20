package sh.measure.rn

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.attributes.BooleanAttr
import sh.measure.android.attributes.DoubleAttr
import sh.measure.android.attributes.StringAttr

object MapUtils {
    fun toMap(readableMap: ReadableMap?): Map<String, Any?> {
        if (readableMap == null) return emptyMap()
        return buildGenericMap(readableMap).toMap()
    }

    fun toMutableMap(readableMap: ReadableMap?): MutableMap<String, Any?> {
        if (readableMap == null) return mutableMapOf()
        return buildGenericMap(readableMap)
    }

    private fun buildGenericMap(readableMap: ReadableMap): MutableMap<String, Any?> {
        val result = mutableMapOf<String, Any?>()
        val iterator = readableMap.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            when (readableMap.getType(key)) {
                ReadableType.Boolean -> result[key] = readableMap.getBoolean(key)
                ReadableType.Number -> {
                    val num = readableMap.getDouble(key)
                    result[key] = if (num == num.toLong().toDouble()) num.toLong() else num
                }
                ReadableType.String -> readableMap.getString(key)?.let { result[key] = it }
                ReadableType.Map -> readableMap.getMap(key)?.let { result[key] = buildGenericMap(it) }
                ReadableType.Array -> result[key] = toList(readableMap.getArray(key))
                else -> result[key] = null
            }
        }
        return result
    }

    fun toStringMap(readableMap: ReadableMap?): Map<String, String> {
        if (readableMap == null) return emptyMap()
        val result = mutableMapOf<String, String>()
        val iterator = readableMap.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            if (readableMap.getType(key) == ReadableType.String) {
                readableMap.getString(key)?.let { result[key] = it }
            }
        }
        return result.toMap()
    }

    fun toAttributeValueMap(readableMap: ReadableMap?): MutableMap<String, AttributeValue> {
        if (readableMap == null) return mutableMapOf()
        val result = mutableMapOf<String, AttributeValue>()
        val iterator = readableMap.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            val type = readableMap.getType(key)
            val value: AttributeValue? = when (type) {
                ReadableType.Null -> null
                ReadableType.Boolean -> BooleanAttr(readableMap.getBoolean(key))
                ReadableType.Number -> DoubleAttr(readableMap.getDouble(key))
                ReadableType.String -> readableMap.getString(key)?.let { StringAttr(it) }
                else -> null // Ignore maps/arrays
            }
            if (value != null) result[key] = value
        }
        return result
    }

    private fun toList(readableArray: ReadableArray?): List<Any?> {
        if (readableArray == null) return emptyList()
        val size = readableArray.size()
        val out = ArrayList<Any?>(size)
        for (i in 0 until size) {
            when (readableArray.getType(i)) {
                ReadableType.Null -> out.add(null)
                ReadableType.Boolean -> out.add(readableArray.getBoolean(i))
                ReadableType.Number -> {
                    val num = readableArray.getDouble(i)
                    out.add(if (num == num.toLong().toDouble()) num.toLong() else num)
                }
                ReadableType.String -> out.add(readableArray.getString(i))
                ReadableType.Map -> out.add(readableArray.getMap(i)?.let { buildGenericMap(it) })
                ReadableType.Array -> out.add(toList(readableArray.getArray(i)))
            }
        }
        return out
    }
}