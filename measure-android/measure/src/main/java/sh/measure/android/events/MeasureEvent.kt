package sh.measure.android.events

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import sh.measure.android.resource.Resource

/**
 * Represents an event in Measure.
 */
@Serializable
internal class MeasureEvent(
    /**
     * A unique UUID for the event.
     */
    val id: String,

    /**
     * The timestamp when the event was created.
     */
    val timestamp: Long,

    /**
     * Also known as log level. Used only for logs taken from Android logcat.
     *
     * Always one of: debug, info, warn, error, fatal
     */
    val severity_text: String? = null,

    /**
     * Attributes for the event.
     */
    val body: EventBody,

    /**
     * A set of attributes which contain the resource information.
     */
    val resource: Resource,

    /**
     * Serialized map of context attributes.
     */
    val attributes: JsonElement?,
)

@Serializable
internal data class EventBody(
    val type: String,
    val value: JsonElement
)