package sh.measure.sample.events

import kotlinx.serialization.Serializable
import sh.measure.sample.logger.Logger
import sh.measure.sample.network.HttpClient

/**
 * A sink that sends events to a HTTP endpoint.
 */
internal class HttpEventSink(private val logger: Logger, private val httpClient: HttpClient) :
    EventSink {

    override fun send(event: MeasureEvent) {
        val eventsRequest = EventsRequest(
            events = listOf(event)
        )

        httpClient.sendEvents(eventsRequest)
    }
}

@Serializable
internal data class EventsRequest(
    val events: List<MeasureEvent>
)


@Serializable
internal data class EventsResponse(
    val event_ids: List<String>
)