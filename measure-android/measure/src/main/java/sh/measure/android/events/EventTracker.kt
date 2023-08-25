package sh.measure.android.events

internal interface IEventTracker {
    fun addEventSink(sink: EventSink)
    fun track(event: MeasureEvent)
}

/**
 * Allows tracking events, transforming them and passing them on to a [EventSink].
 */
internal class EventTracker : IEventTracker {
    private val _sinks: MutableList<EventSink> = mutableListOf()

    override fun addEventSink(sink: EventSink) {
        _sinks.add(sink)
    }

    override fun track(event: MeasureEvent) {
        _sinks.forEach { sink -> sink.send(event) }
    }
}

/**
 * A sink is responsible for sending [MeasureEvent] to a destination, typically a database or
 * remote server.
 */
internal interface EventSink {
    fun send(event: MeasureEvent)
}
