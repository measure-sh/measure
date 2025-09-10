package sh.measure.rn

import android.util.Base64
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import sh.measure.android.MsrAttachment

import sh.measure.android.attributes.AttributeValue
import sh.measure.android.attributes.BooleanAttr
import sh.measure.android.attributes.IntAttr
import sh.measure.android.attributes.LongAttr
import sh.measure.android.attributes.DoubleAttr
import sh.measure.android.attributes.StringAttr

object MapUtils {
    fun toMap(readableMap: ReadableMap?): Map<String, Any?> {
        return buildGenericMap(readableMap).toMap()
    }

    fun toMutableMap(readableMap: ReadableMap?): MutableMap<String, Any?> {
        return buildGenericMap(readableMap)
    }

    private fun buildGenericMap(readableMap: ReadableMap?): MutableMap<String, Any?> {
        val result = mutableMapOf<String, Any?>()
        if (readableMap == null) return result

        val iterator = readableMap.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            when (readableMap.getType(key)) {
                ReadableType.Null     -> result[key] = null
                ReadableType.Boolean  -> result[key] = readableMap.getBoolean(key)
                ReadableType.Number   -> {
                    val num = readableMap.getDouble(key)
                    result[key] = if (num == num.toLong().toDouble()) num.toLong() else num
                }
                ReadableType.String   -> result[key] = readableMap.getString(key)
                ReadableType.Map      -> result[key] = buildGenericMap(readableMap.getMap(key))
                ReadableType.Array    -> result[key] = toList(readableMap.getArray(key)!!)
            }
        }
        return result
    }

    fun toStringMap(readableMap: ReadableMap?): Map<String, String> {
        val result = mutableMapOf<String, String>()
        if (readableMap == null) return result.toMap()

        val iterator = readableMap.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            if (readableMap.getType(key) == ReadableType.String) {
                result[key] = readableMap.getString(key) ?: ""
            }
        }
        return result.toMap()
    }

    fun toAttributeValueMap(readableMap: ReadableMap?): MutableMap<String, AttributeValue> {
        val result = mutableMapOf<String, AttributeValue>()
        if (readableMap == null) return result

        val iterator = readableMap.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            val type = readableMap.getType(key)
            val value: AttributeValue? = when (type) {
                ReadableType.Null     -> null
                ReadableType.Boolean  -> BooleanAttr(readableMap.getBoolean(key))
                ReadableType.Number   -> {
                    val num = readableMap.getDouble(key)
                    when {
                        num == num.toInt().toDouble()   -> IntAttr(num.toInt())
                        num == num.toLong().toDouble() -> LongAttr(num.toLong())
                        else                           -> DoubleAttr(num)
                    }
                }
                ReadableType.String   -> StringAttr(readableMap.getString(key) ?: "")
                else -> null
            }
            if (value != null) result[key] = value
        }
        return result
    }

    fun toAttachmentList(readableArray: ReadableArray?): MutableList<MsrAttachment> {
        val result = mutableListOf<MsrAttachment>()
        if (readableArray == null) return result

        // for (i in 0 until readableArray.size()) {
        //     val type = readableArray.getType(i)
        //     if (type == ReadableType.Map) {
        //         val map = readableArray.getMap(i) ?: continue
        //         val name = map.getString("name") ?: continue
        //         val base64 = map.getString("bytes") ?: continue
        //         val bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)

        //         val attachmentType = map.getString("type") ?: "screenshot"

        //         result.add(MsrAttachment(name = name, bytes = bytes, type = attachmentType))
        //     }
        // }
        return result
    }

    private fun toList(readableArray: ReadableArray): List<Any?> {
        val size = readableArray.size()
        val out = ArrayList<Any?>(size)
        for (i in 0 until size) {
            when (readableArray.getType(i)) {
                ReadableType.Null     -> out.add(null)
                ReadableType.Boolean  -> out.add(readableArray.getBoolean(i))
                ReadableType.Number   -> {
                    val num = readableArray.getDouble(i)
                    out.add(if (num == num.toLong().toDouble()) num.toLong() else num)
                }
                ReadableType.String   -> out.add(readableArray.getString(i))
                ReadableType.Map      -> out.add(buildGenericMap(readableArray.getMap(i)))
                ReadableType.Array    -> out.add(toList(readableArray.getArray(i)!!))
            }
        }
        return out
    }
}