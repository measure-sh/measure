package sh.measure.flutter

import sh.measure.android.attributes.AttributeValue
import sh.measure.android.attributes.BooleanAttr
import sh.measure.android.attributes.DoubleAttr
import sh.measure.android.attributes.FloatAttr
import sh.measure.android.attributes.IntAttr
import sh.measure.android.attributes.LongAttr
import sh.measure.android.attributes.StringAttr

object AttributeConverter {
    fun convertAttributes(attributes: Map<String, Any?>): MutableMap<String, AttributeValue> {
        return attributes.mapValuesTo(mutableMapOf()) { (key, value) ->
            try {
                when (value) {
                    is String -> StringAttr(value)
                    is Boolean -> BooleanAttr(value)
                    is Int -> IntAttr(value)
                    is Long -> LongAttr(value)
                    is Float -> FloatAttr(value)
                    is Double -> DoubleAttr(value)
                    else -> throw MethodArgumentException(
                        code = ErrorCode.ERROR_INVALID_ATTRIBUTE,
                        message = "Invalid attribute type for key '$key'",
                        details = "Supported types: String, Boolean, Int, Long, Float, Double"
                    )
                }
            } catch (e: Exception) {
                throw MethodArgumentException(
                    code = ErrorCode.ERROR_INVALID_ATTRIBUTE,
                    message = "Failed to convert attribute '$key'",
                    details = e.message ?: "Unknown error"
                )
            }
        }
    }
}