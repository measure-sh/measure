package sh.measure.android.events

import sh.measure.android.events.sinks.Sink

/**
 * Allows tracking events, transforming them and passing them on to a [Sink].
 */
internal interface Tracker {
    /**
     * Adds a [Sink] to the tracker.
     */
    fun addEventSink(sink: Sink)

    /**
     * Tracks a [MeasureEvent].
     *
     * @param event The event to track.
     * @param immediate Whether the event needs to be precessed immediately.
     */
    fun track(event: MeasureEvent, immediate: Boolean = false)
}

/**
 * A default implementation of [Tracker].
 */
internal class DefaultTracker : Tracker {
    private val _sinks: MutableList<Sink> = mutableListOf()

    override fun addEventSink(sink: Sink) {
        _sinks.add(sink)
    }

    override fun track(event: MeasureEvent, immediate: Boolean) {
        _sinks.forEach { sink -> sink.offer(event, immediate) }
    }
}
