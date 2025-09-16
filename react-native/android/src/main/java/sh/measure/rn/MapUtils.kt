package sh.measure.rn

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import sh.measure.android.attributes.AttributeValue
import sh.measure.android.attributes.BooleanAttr
import sh.measure.android.attributes.DoubleAttr
import sh.measure.android.attributes.StringAttr

object MapUtils {
    fun toMap(readableMap: ReadableMap): Map<String, Any?> {
        return buildGenericMap(readableMap).toMap()
    }

    fun toMutableMap(readableMap: ReadableMap): MutableMap<String, Any?> {
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
                    // TODO: assuming all numbers are doubles for now
                    //  we should ideally cast the number to the correct
                    //  type
                    val num: Double = readableMap.getDouble(key)
                    result[key] = num
                }

                ReadableType.String -> {
                    readableMap.getString(key)?.let {
                        result[key] = it
                    }
                }

                ReadableType.Map -> {
                    readableMap.getMap(key)?.let {
                        result[key] = buildGenericMap(it)
                    }
                }

                ReadableType.Array -> result[key] = toList(readableMap.getArray(key))

                else -> null
            }
        }
        return result
    }

    fun toStringMap(readableMap: ReadableMap): Map<String, String> {
        val result = mutableMapOf<String, String>()
        val iterator = readableMap.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            if (readableMap.getType(key) == ReadableType.String) {
                val value = readableMap.getString(key)
                if (value == null) {
                    continue
                }
                result[key] = value
            }
        }
        return result.toMap()
    }

    fun toAttributeValueMap(readableMap: ReadableMap): MutableMap<String, AttributeValue> {
        val result = mutableMapOf<String, AttributeValue>()
        val iterator = readableMap.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            val type = readableMap.getType(key)
            val value: AttributeValue? = when (type) {
                ReadableType.Null -> null
                ReadableType.Boolean -> BooleanAttr(readableMap.getBoolean(key))
                ReadableType.Number -> {
                    // TODO: assuming all numbers are doubles for now
                    //  we should ideally cast the number to the correct
                    //  type
                    val num: Double = readableMap.getDouble(key)
                    DoubleAttr(num)
                }

                ReadableType.String -> {
                    val value = readableMap.getString(key)
                    when {
                        value != null -> StringAttr(value)
                        else -> null
                    }
                }

                else -> {
                    // Attribute values can never have a map, array or
                    // null value. We ignore such attributes if we
                    // encounter it here.
                    null
                }
            }
            if (value != null) result[key] = value
        }
        return result
    }

    private fun toList(readableArray: ReadableArray?): List<Any?> {
        if (readableArray == null) {
            return emptyList()
        }
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
                ReadableType.Map -> out.add(buildGenericMap(readableArray.getMap(i)))
                ReadableType.Array -> out.add(toList(readableArray.getArray(i)))
            }
        }
        return out
    }
}