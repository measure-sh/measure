package sh.measure.android.attributes

/**
 * An interface marking a class as an attribute processor. It is responsible for generating, caching
 * and appending attributes to an event. All attribute processors run must be safe to run in a
 * background thread.
 *
 * @see [ComputeOnceAttributeCollector] for an implementation that computes the attributes once and
 * caches them.
 */
internal interface AttributeCollector {
    fun append(attrs: MutableMap<String, Any?>)
}
