package sh.measure.android.events

import kotlinx.serialization.json.Json
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

/**
 * A sink that logs events to console using a [Logger].
 */
internal class LoggingEventSink(private val logger: Logger) : EventSink {
    override fun send(event: MeasureEvent) {
        logger.log(LogLevel.Info, Json.encodeToString(MeasureEvent.serializer(), event))
    }
}