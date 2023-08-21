package sh.measure.sample.events

import kotlinx.serialization.json.JsonElement
import sh.measure.sample.resource.Resource
import java.util.UUID

/**
 * Factory for creating [MeasureEvent]s.
 */
internal class MeasureEventFactory {

    companion object {
        fun createMeasureEvent(
            type: String,
            resource: Resource,
            attributes: JsonElement,
            sessionId: String,
            context: JsonElement?,
            id: String? = null,
            timestamp: String? = null
        ): MeasureEvent {
            return MeasureEventFactory().createMeasureEvent(
                type, resource, attributes, sessionId, context, id, timestamp
            )
        }
    }

    /**
     * Creates a [MeasureEvent] with the given parameters. Automatically adds a timestamp and
     * ID if not provided in the arguments.
     */
    private fun createMeasureEvent(
        type: String,
        resource: Resource,
        attributes: JsonElement,
        sessionId: String,
        context: JsonElement?,
        id: String? = null,
        timestamp: String? = null,
    ): MeasureEvent {
        return MeasureEvent(
            id = id ?: UUID.randomUUID()
                .toString(), // TODO(abhay): Create an abstraction over ID generation
            timestamp = timestamp ?: System.currentTimeMillis()
                .toString(), // TODO(abhay): Create an abstraction over timestamp creation and use ISO 8601 format
            type = type,
            resource = resource,
            attributes = attributes,
            session_id = sessionId,
            context = context
        )
    }
}
