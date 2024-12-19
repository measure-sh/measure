package sh.measure.android.attributes

/**
 * Builder for creating attributes.
 */
class AttributesBuilder {
    private val attributes = mutableMapOf<String, AttributeValue>()

    fun put(key: String, value: String): AttributesBuilder {
        attributes[key] = StringAttr(value)
        return this
    }

    fun put(key: String, value: Int): AttributesBuilder {
        attributes[key] = IntAttr(value)
        return this
    }

    fun put(key: String, value: Long): AttributesBuilder {
        attributes[key] = LongAttr(value)
        return this
    }

    fun put(key: String, value: Double): AttributesBuilder {
        attributes[key] = DoubleAttr(value)
        return this
    }

    fun put(key: String, value: Float): AttributesBuilder {
        attributes[key] = FloatAttr(value)
        return this
    }

    fun put(key: String, value: Boolean): AttributesBuilder {
        attributes[key] = BooleanAttr(value)
        return this
    }

    fun build(): Map<String, AttributeValue> = attributes.toMap()
}
