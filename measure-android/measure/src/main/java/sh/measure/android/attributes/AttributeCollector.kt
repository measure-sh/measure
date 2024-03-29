package sh.measure.android.attributes

/**
 * An interface marking a class as an attribute generator. Implementations should return a map of
 * attributes.
 *
 * The attributes are used to enrich the events sent to the server and are sent along with every
 * event.
 *
 * @see [ComputeOnceAttributeCollector] for an implementation that computes the attributes once and
 * caches them.
 */
internal interface AttributeCollector {
    fun append(attrs: MutableMap<String, Any?>)
}
