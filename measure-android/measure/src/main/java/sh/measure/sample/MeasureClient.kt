package sh.measure.sample

import android.content.Context
import kotlinx.serialization.json.Json
import sh.measure.sample.events.EventTracker
import sh.measure.sample.events.EventType
import sh.measure.sample.events.HttpEventSink
import sh.measure.sample.events.LoggingEventSink
import sh.measure.sample.events.MeasureEventFactory
import sh.measure.sample.exceptions.ExceptionData
import sh.measure.sample.exceptions.UnhandledExceptionCollector
import sh.measure.sample.id.IdProvider
import sh.measure.sample.id.UUIDProvider
import sh.measure.sample.logger.Logger
import sh.measure.sample.network.HttpClient
import sh.measure.sample.network.HttpClientOkHttp
import sh.measure.sample.resource.ResourceFactory
import sh.measure.sample.time.AndroidDateProvider
import sh.measure.sample.time.DateProvider

/**
 * Maintains global state and provides a way for different components to communicate with each
 * other.
 */
internal class MeasureClient(private val logger: Logger, context: Context) {
    private val idProvider: IdProvider = UUIDProvider()
    private val dateProvider: DateProvider = AndroidDateProvider
    private val resource =
        ResourceFactory.create(logger, context, sessionId = idProvider.createId())

    // TODO(abhay): Replace with the real server URL. Ideally configured via a Gradle property.
    private val httpClient: HttpClient = HttpClientOkHttp(
        logger, baseUrl = "https://www.example.com/"
    )
    private val eventTracker = EventTracker()

    fun init() {
        eventTracker.apply {
            addEventSink(LoggingEventSink(logger))
            addEventSink(HttpEventSink(logger, httpClient))
        }
        UnhandledExceptionCollector(logger, this).register()
    }

    fun captureException(exceptionData: ExceptionData) {
        val event = MeasureEventFactory.createMeasureEvent(
            type = EventType.EXCEPTION,
            bodyValue = Json.encodeToJsonElement(ExceptionData.serializer(), exceptionData),
            resource = resource,
            idProvider = idProvider,
            dateProvider = dateProvider
        )
        eventTracker.track(event)
    }
}
