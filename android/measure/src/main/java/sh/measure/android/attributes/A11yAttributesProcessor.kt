package sh.measure.android.attributes

import sh.measure.android.utils.SystemServiceProvider

/**
 * Generates the accessibility attributes. These attributes are expected to change during the
 * session. This class computes the attributes every time [appendAttributes] is called.
 */
internal class A11yAttributesProcessor(
    private val systemServiceProvider: SystemServiceProvider,
) : AttributeProcessor {
    override fun appendAttributes(attributes: MutableMap<String, Any?>) {
        val isEnabled = systemServiceProvider.accessibilityManager?.isEnabled
        attributes.apply {
            put(Attribute.ACCESSIBILITY_ENABLED, isEnabled)
        }
    }
}
