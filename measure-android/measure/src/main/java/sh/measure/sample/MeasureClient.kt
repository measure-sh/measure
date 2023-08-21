package sh.measure.sample

import android.content.Context
import kotlinx.serialization.json.Json
import sh.measure.sample.context.MeasureContext
import sh.measure.sample.events.EventTracker
import sh.measure.sample.events.EventType
import sh.measure.sample.events.LoggingEventSink
import sh.measure.sample.events.MeasureEventFactory
import sh.measure.sample.exceptions.ExceptionData
import sh.measure.sample.exceptions.UnhandledExceptionCollector
import sh.measure.sample.logger.Logger
import sh.measure.sample.resource.ResourceFactory

/**
 * Maintains global state and provides a way for different components to communicate with each
 * other.
 */
internal class MeasureClient(private val logger: Logger, context: Context) {
    private val resource = ResourceFactory.create(logger, context)
    private val measureContext = MeasureContext()
    private val eventTracker = EventTracker()

    fun init() {
        eventTracker.apply {
            addEventSink(LoggingEventSink(logger))
        }
        UnhandledExceptionCollector(logger, this).register()
    }

    fun captureException(exceptionData: ExceptionData) {
        val event = MeasureEventFactory.createMeasureEvent(
            type = EventType.EXCEPTION,
            resource = resource,
            attributes = Json.encodeToJsonElement(ExceptionData.serializer(), exceptionData),
            sessionId = "session_id",
            context = measureContext.getJsonElement(),
        )
        eventTracker.track(event)
    }
}






