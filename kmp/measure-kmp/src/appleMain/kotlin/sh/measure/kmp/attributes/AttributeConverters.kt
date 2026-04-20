package sh.measure.kmp.attributes

internal fun AttributeValue.toNative(): Any = when (this) {
    is StringAttr -> value
    is BooleanAttr -> value
    is IntAttr -> value
    is LongAttr -> value
    is FloatAttr -> value
    is DoubleAttr -> value
}

internal fun Map<String, AttributeValue>.toNative(): Map<Any?, Any> =
    entries.associate { (k, v) -> k to v.toNative() }
