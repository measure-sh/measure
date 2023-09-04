package sh.measure.android.events

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.encodeToJsonElement
import sh.measure.android.id.IdProvider
import sh.measure.android.resource.Resource
import sh.measure.android.time.DateProvider

/**
 * Factory for creating [MeasureEvent]s.
 */
internal class MeasureEventFactory(
    private val idProvider: IdProvider, private val dateProvider: DateProvider
) {

    companion object {
        fun createMeasureEvent(
            type: String,
            value: JsonElement,
            resource: Resource,
            idProvider: IdProvider,
            dateProvider: DateProvider,
            id: String? = null,
            timestamp: Long? = null,
            attributes: JsonElement? = null
        ): MeasureEvent {
            return MeasureEventFactory(idProvider, dateProvider).createMeasureEvent(
                eventType = type,
                bodyValue = value,
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
            timestamp = timestamp ?: dateProvider.currentTimeSinceEpochInNanos,
            body = JsonObject(
                mapOf(
                    "type" to Json.encodeToJsonElement(eventType), eventType to bodyValue
                )
            ),
            resource = resource,
            attributes = attributes
        )
    }
}
