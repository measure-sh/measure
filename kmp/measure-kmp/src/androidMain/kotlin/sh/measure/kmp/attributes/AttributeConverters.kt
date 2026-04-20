package sh.measure.kmp.attributes

import sh.measure.android.attributes.AttributeValue as AndroidAttributeValue
import sh.measure.android.attributes.BooleanAttr as AndroidBooleanAttr
import sh.measure.android.attributes.DoubleAttr as AndroidDoubleAttr
import sh.measure.android.attributes.FloatAttr as AndroidFloatAttr
import sh.measure.android.attributes.IntAttr as AndroidIntAttr
import sh.measure.android.attributes.LongAttr as AndroidLongAttr
import sh.measure.android.attributes.StringAttr as AndroidStringAttr

internal fun AttributeValue.toAndroid(): AndroidAttributeValue = when (this) {
    is StringAttr -> AndroidStringAttr(value)
    is BooleanAttr -> AndroidBooleanAttr(value)
    is IntAttr -> AndroidIntAttr(value)
    is LongAttr -> AndroidLongAttr(value)
    is FloatAttr -> AndroidFloatAttr(value)
    is DoubleAttr -> AndroidDoubleAttr(value)
}

internal fun Map<String, AttributeValue>.toAndroid(): Map<String, AndroidAttributeValue> =
    mapValues { (_, v) -> v.toAndroid() }
