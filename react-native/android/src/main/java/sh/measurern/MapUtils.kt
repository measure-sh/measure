package sh.measure.rn

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

object MapUtils {
    fun toMap(readableMap: ReadableMap?): Map<String, Any?> {
        val result = mutableMapOf<String, Any?>()
        if (readableMap == null) return result.toMap()

        val iterator = readableMap.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            when (readableMap.getType(key)) {
                ReadableType.Null     -> result[key] = null
                ReadableType.Boolean  -> result[key] = readableMap.getBoolean(key)
                ReadableType.Number   -> result[key] = readableMap.getDouble(key)
                ReadableType.String   -> result[key] = readableMap.getString(key)
                ReadableType.Map      -> result[key] = toMap(readableMap.getMap(key))
                ReadableType.Array    -> { /* ignore arrays */ }
            }
        }
        return result.toMap()
    }

    fun toStringMap(readableMap: ReadableMap?): Map<String, String> {
        val result = mutableMapOf<String, String>()
        if (readableMap == null) return result.toMap()

        val iterator = readableMap.keySetIterator()
        while (iterator.hasNextKey()) {
            val key  = iterator.nextKey()
            val type = readableMap.getType(key)

            if (type == ReadableType.String) {
                result[key] = readableMap.getString(key) ?: ""
            }
        }
        return result.toMap()
    }
}