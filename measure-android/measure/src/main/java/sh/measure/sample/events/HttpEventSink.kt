package sh.measure.sample.events

import kotlinx.serialization.Serializable
import sh.measure.sample.logger.LogLevel
import sh.measure.sample.logger.Logger
import sh.measure.sample.network.HttpClient

/**
 * The number of events needed in a batch to be sent to server.
 */
private const val BATCH_SIZE = 10

/**
 * A sink that sends events to a HTTP endpoint.
 */
internal class HttpEventSink(private val logger: Logger, private val httpClient: HttpClient) :
    EventSink {
    private val buffer = Buffer()

    override fun send(event: MeasureEvent) {
        buffer.add(event)

        // Send the events if the buffer is full or if the event is an exception.
        // Attempt to send exceptions immediately, so that they can be reported as soon as possible.
        if (buffer.isFull || event.body.type == EventType.EXCEPTION) {
            val eventsRequest = EventsRequest(buffer.flush())
            httpClient.sendEvents(eventsRequest)
        } else {
            logger.log(LogLevel.Info, "Event buffered, to be sent later: ${event.id}")
        }
    }
}

private class Buffer {
    private val events = mutableListOf<MeasureEvent>()

    fun flush(): List<MeasureEvent> {
        val copy = List(events.size) { events[it] }
        events.clear()
        return copy
    }

    val isFull: Boolean
        get() = events.size >= BATCH_SIZE

    fun add(event: MeasureEvent) {
        events.add(event)
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