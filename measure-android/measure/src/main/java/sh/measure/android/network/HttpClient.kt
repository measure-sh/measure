package sh.measure.android.network

import sh.measure.android.events.MeasureEvent

internal interface HttpClient {
    fun sendEvents(events: List<MeasureEvent>, callback: HttpCallback? = null)
}

internal interface HttpCallback {
    fun onSuccess() {}
    fun onFailure() {}
}
