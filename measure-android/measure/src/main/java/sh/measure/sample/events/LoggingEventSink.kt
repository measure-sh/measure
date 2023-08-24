package sh.measure.sample.events

import kotlinx.serialization.json.Json
import sh.measure.sample.logger.LogLevel
import sh.measure.sample.logger.Logger

/**
 * A sink that logs events to console using a [Logger].
 */
internal class LoggingEventSink(private val logger: Logger) : EventSink {
    override fun send(event: MeasureEvent) {
        logger.log(LogLevel.Info, Json.encodeToString(MeasureEvent.serializer(), event))
    }
}