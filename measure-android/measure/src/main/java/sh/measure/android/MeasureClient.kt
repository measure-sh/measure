package sh.measure.android

import android.content.Context
import kotlinx.serialization.json.Json
import sh.measure.android.events.EventTracker
import sh.measure.android.events.EventType
import sh.measure.android.events.HttpEventSink
import sh.measure.android.events.LoggingEventSink
import sh.measure.android.events.MeasureEventFactory
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.id.IdProvider
import sh.measure.android.id.UUIDProvider
import sh.measure.android.logger.Logger
import sh.measure.android.network.HttpClient
import sh.measure.android.network.HttpClientOkHttp
import sh.measure.android.resource.ResourceFactory
import sh.measure.android.time.AndroidDateProvider
import sh.measure.android.time.DateProvider

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
            value = Json.encodeToJsonElement(ExceptionData.serializer(), exceptionData),
            resource = resource,
            idProvider = idProvider,
            dateProvider = dateProvider
        )
        eventTracker.track(event)
    }
}
