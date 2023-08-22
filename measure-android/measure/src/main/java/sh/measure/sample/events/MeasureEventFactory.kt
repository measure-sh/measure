package sh.measure.sample.events

import kotlinx.serialization.json.JsonElement
import sh.measure.sample.id.IdProvider
import sh.measure.sample.resource.Resource
import sh.measure.sample.time.DateProvider

/**
 * Factory for creating [MeasureEvent]s.
 */
internal class MeasureEventFactory(
    private val idProvider: IdProvider, private val dateProvider: DateProvider
) {

    companion object {
        fun createMeasureEvent(
            type: String,
            bodyValue: JsonElement,
            resource: Resource,
            idProvider: IdProvider,
            dateProvider: DateProvider,
            id: String? = null,
            timestamp: Long? = null,
            attributes: JsonElement? = null
        ): MeasureEvent {
            return MeasureEventFactory(idProvider, dateProvider).createMeasureEvent(
                eventType = type,
                bodyValue = bodyValue,
                resource = resource,
                attributes = attributes,
                id = id,
                timestamp = timestamp
            )
        }
    }

    /**
     * Creates a [MeasureEvent] with the given parameters. Automatically adds a timestamp and
     * ID if not provided in the arguments.
     */
    private fun createMeasureEvent(
        eventType: String,
        bodyValue: JsonElement,
        resource: Resource,
        attributes: JsonElement?,
        id: String? = null,
        timestamp: Long? = null,
    ): MeasureEvent {
        return MeasureEvent(
            id = id ?: idProvider.createId(),
            timestamp = timestamp ?: dateProvider.currentTimeSinceEpochInMillis,
            body = EventBody(
                type = eventType,
                value = bodyValue,
            ),
            resource = resource,
            attributes = attributes
        )
    }
}
