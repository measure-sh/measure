package sh.measure.android.events

import sh.measure.android.attributes.AttributeProcessor

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

    /**
     * Additional key value pairs that can be added to the event.
     *
     * Attributes can be set by one of the collectors or by [AttributeProcessor].
     */
    val attributes: MutableMap<String, Any?> = mutableMapOf(),
) {
    /**
     * Attachments that can be added to the event.
     */
    val attachments: MutableList<Attachment> = mutableListOf()

/**
     * Adds an attachment to the event.
     *
     * @param attachment The attachment to add.
     */
    fun withAttachment(attachment: Attachment): Event<T> {
        attachments.add(attachment)
        return this
    }
}
