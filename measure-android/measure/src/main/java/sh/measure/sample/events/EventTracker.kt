package sh.measure.sample.events

import kotlinx.serialization.json.Json
import sh.measure.sample.logger.LogLevel
import sh.measure.sample.logger.Logger

/**
 * Allows tracking events, transforming them and passing them on to a [EventSink].
 */
internal class EventTracker {
    private val _sinks: MutableList<EventSink> = mutableListOf()

    fun addEventSink(sink: EventSink) {
        _sinks.add(sink)
    }

    fun track(event: MeasureEvent) {
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

/**
 * A sink that logs events to console using a [Logger].
 */
internal class LoggingEventSink(private val logger: Logger) : EventSink {
    override fun send(event: MeasureEvent) {
        logger.log(LogLevel.Info, Json.encodeToString(MeasureEvent.serializer(), event))
    }
}
