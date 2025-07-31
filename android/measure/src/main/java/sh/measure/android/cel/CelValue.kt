package sh.measure.android.cel

sealed class CelValue {
    data class Number(val value: Double) : CelValue()
    data class String(val value: kotlin.String) : CelValue()
    data class Boolean(val value: kotlin.Boolean) : CelValue()
    data class Timestamp(val value: Long) : CelValue()
    data class Duration(val value: Long) : CelValue()
    object Null : CelValue()

    fun toBoolean(): kotlin.Boolean {
        return when (this) {
            is Boolean -> value
            is Null -> false
            is Number -> value != 0.0
            is String -> value.isNotEmpty()
            is Timestamp -> true
            is Duration -> value != 0L
        }
    }

    override fun toString(): kotlin.String {
        return when (this) {
            is Number -> value.toString()
            is String -> value
            is Boolean -> value.toString()
            is Timestamp -> value.toString()
            is Duration -> value.toString()
            is Null -> "null"
        }
    }
}