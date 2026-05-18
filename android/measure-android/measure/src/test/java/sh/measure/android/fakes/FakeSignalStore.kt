package sh.measure.android.fakes

import sh.measure.android.events.Event
import sh.measure.android.storage.SignalStore
import sh.measure.android.tracing.SpanData

internal class FakeSignalStore : SignalStore {
    val trackedEvents = mutableListOf<Event<*>>()
    val trackedSpans = mutableListOf<SpanData>()

    override fun <T> store(event: Event<T>) {
        trackedEvents.add(event)
    }

    override fun store(spanData: SpanData) {
        trackedSpans.add(spanData)
    }

    override fun flush() {
        // No-op
    }
}
