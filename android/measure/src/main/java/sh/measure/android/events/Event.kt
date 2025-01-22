package sh.measure.android.events

import sh.measure.android.attributes.AttributeValue

/**
 * Represents an event in Measure. This object maps very closely to the event object in
 * the Measure API.
 */
internal data class Event<T>(
    /**
     * A unique identifier for the event.
     */
    val id: String,

    /**
     * The session id of the event. This is the session id of the session in which the event was
     * triggered.
     */
    val sessionId: String,

    /**
     * The timestamp of the event. The time when the event was triggered. Measured in milliseconds
     * since epoch.
     */
    val timestamp: String,

    /**
     * The type of the event. See [EventType] for the list of event types.
     */
    val type: String,

    /**
     * The data collected. This can be any object that is annotated with `@Serializable`.
     */
    val data: T,

    /**
     * Attachments that can be added to the event.
     */
    val attachments: MutableList<Attachment>,

    /**
     * Additional key value pairs that can be added to the event.
     */
    val attributes: MutableMap<String, Any?>,

    /**
     * A flag to indicate if the event is triggered by the user or the SDK.
     */
    val userTriggered: Boolean,

    /**
     * Attributes set by the user in the event. The type of values in the map is set to Any here,
     * however, the allowed values can only be String, Int, Long, Double, Float or Boolean.
     */
    val userDefinedAttributes: Map<String, AttributeValue>,
) {
    /**
     * Adds an attribute to the event.
     *
     * @param key The key of the attribute.
     * @param value The value of the attribute.
     */
    fun appendAttribute(key: String, value: Any?) {
        attributes[key] = value
    }

    fun addAttachment(attachment: Attachment) {
        attachments.add(attachment)
    }
}
