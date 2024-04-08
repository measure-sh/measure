package sh.measure.android.events

import kotlinx.serialization.json.JsonElement
import sh.measure.android.utils.toJsonElement

/**
 * Represents an event in Measure. This object maps very closely to the event object in
 * the Measure API.
 */
internal data class Event<T>(
    /**
     * The timestamp of the event. The time when the event was triggered. Measured in milliseconds
     * since epoch.
     */
    val timestamp: Long,

    /**
     * The type of the event. See [EventType] for the list of event types.
     */
    val type: String,

    /**
     * The data collected. This can be any object that is annotated with `@Serializable`.
     */
    val data: T,
) {
    /**
     * Attachments that can be added to the event.
     */
    val attachments: MutableList<Attachment> = mutableListOf()

    /**
     * Additional key value pairs that can be added to the event.
     */
    val attributes: MutableMap<String, Any?> = mutableMapOf()

    /**
     * Adds an attachment to the event.
     *
     * @param attachment The attachment to add.
     */
    fun withAttachment(attachment: Attachment): Event<T> {
        attachments.add(attachment)
        return this
    }

    /**
     * Adds an attribute to the event.
     *
     * @param key The key of the attribute.
     * @param value The value of the attribute. The value can be of any time which can be converted
     * to a [JsonElement], see [toJsonElement] for the types that are supported.
     */
    fun withAttribute(key: String, value: Any?): Event<T> {
        attributes[key] = value
        return this
    }
}
