package sh.measure.android.events.sinks

import kotlinx.serialization.json.Json
import sh.measure.android.events.MeasureEvent
import sh.measure.android.logger.LogLevel
import sh.measure.android.logger.Logger

/**
 * A sink that logs events to console using a [Logger].
 */
internal class LoggingSink(private val logger: Logger) : Sink {
    override fun offer(event: MeasureEvent, immediate: Boolean) {
        logger.log(LogLevel.Info, Json.encodeToString(MeasureEvent.serializer(), event))
    }
}