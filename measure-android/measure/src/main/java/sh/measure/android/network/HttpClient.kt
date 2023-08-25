package sh.measure.android.network

import sh.measure.android.events.EventsRequest

internal interface HttpClient {
    fun sendEvents(events: EventsRequest)
}
