package sh.measure.kmp.attributes

import kotlin.jvm.JvmInline

/**
 * Represents a value of an attribute. It can be a string, boolean, integer, long, float, or double.
 */
sealed interface AttributeValue {
    val value: Any
}

@JvmInline
value class StringAttr(override val value: String) : AttributeValue

@JvmInline
value class BooleanAttr(override val value: Boolean) : AttributeValue

@JvmInline
value class IntAttr(override val value: Int) : AttributeValue

@JvmInline
value class LongAttr(override val value: Long) : AttributeValue

@JvmInline
value class FloatAttr(override val value: Float) : AttributeValue

@JvmInline
value class DoubleAttr(override val value: Double) : AttributeValue
