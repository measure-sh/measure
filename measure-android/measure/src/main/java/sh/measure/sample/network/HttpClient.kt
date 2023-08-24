package sh.measure.sample.network

import sh.measure.sample.events.EventsRequest

internal interface HttpClient {
    fun sendEvents(events: EventsRequest)
}
