package sh.measure.sample.events

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import sh.measure.sample.resource.Resource

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
     * Represents a type of event in Measure.
     * Event types are well known and are used to identify the schema of [attributes].
     */
    val type: String,

    /**
     * A set of attributes which contain the resource information.
     */
    val resource: Resource,

    /**
     * Attributes for the event.
     */
    val attributes: JsonElement,

    /**
     * Serialized map of context attributes.
     */
    val context: JsonElement?,

    /**
     * The timestamp when the event was created.
     */
    val timestamp: String,

    /**
     * A session ID to associate the event with a session.
     */
    val session_id: String
)
