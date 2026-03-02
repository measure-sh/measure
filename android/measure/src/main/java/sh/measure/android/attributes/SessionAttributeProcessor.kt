package sh.measure.android.attributes

import sh.measure.android.SessionManager

/**
 * Generates the session start time attribute. This attribute changes when a new session is created,
 * so it is computed every time [appendAttributes] is called.
 */
internal class SessionAttributeProcessor(
    private val sessionManager: SessionManager,
) : AttributeProcessor {
    override fun appendAttributes(attributes: MutableMap<String, Any?>) {
        attributes.put(Attribute.SESSION_START_TIME_KEY, sessionManager.getSessionStartTime())
    }
}
