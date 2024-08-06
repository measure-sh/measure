package sh.measure.android.attributes

/**
 * Generates the attributes once and then caches them. Subsequent calls to [appendAttributes] will return the
 * cached attributes. This is useful for attributes that are expensive to compute and are not
 * expected to change.
 *
 * Implementations should override [computeAttributes] to compute the attributes and do not need
 * to override [appendAttributes].
 */
internal abstract class ComputeOnceAttributeProcessor : AttributeProcessor {
    private var isComputed = false
    private lateinit var cachedAttrs: Map<String, Any?>

    override fun appendAttributes(attributes: MutableMap<String, Any?>) {
        if (!isComputed) {
            this.cachedAttrs = computeAttributes()
            attributes.putAll(this.cachedAttrs)
            isComputed = true
        }
        attributes.putAll(cachedAttrs)
    }

    /**
     * Compute the attributes and return them as a map.
     */
    abstract fun computeAttributes(): Map<String, Any?>
}
