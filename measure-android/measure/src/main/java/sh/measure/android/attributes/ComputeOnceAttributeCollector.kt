package sh.measure.android.attributes

/**
 * Generates the attributes once and then caches them. Subsequent calls to [append] will return the
 * cached attributes. This is useful for attributes that are expensive to compute and are not
 * expected to change.
 *
 * Implementations should override [computeAttributes] to compute the attributes and do not need
 * to override [append].
 */
internal abstract class ComputeOnceAttributeCollector : AttributeCollector {
    private var isComputed = false
    private lateinit var attributes: Map<String, Any?>

    override fun append(attrs: MutableMap<String, Any?>) {
        if (!isComputed) {
            attributes = computeAttributes()
            attrs.putAll(attributes)
            isComputed = true
        }
        return attrs.putAll(attributes)
    }

    /**
     * Compute the attributes and return them as a map.
     */
    abstract fun computeAttributes(): Map<String, Any?>
}
