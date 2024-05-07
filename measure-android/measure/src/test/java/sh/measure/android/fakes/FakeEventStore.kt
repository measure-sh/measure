package sh.measure.android.fakes

import sh.measure.android.events.Event
import sh.measure.android.storage.EventStore

internal class FakeEventStore : EventStore {
    val trackedEvents = mutableListOf<Event<*>>()

    override fun <T> store(event: Event<T>) {
        trackedEvents.add(event)
    }
}
