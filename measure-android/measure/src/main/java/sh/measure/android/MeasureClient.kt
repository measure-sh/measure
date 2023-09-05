package sh.measure.android

import android.content.Context
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import sh.measure.android.database.DbClient
import sh.measure.android.database.SqliteDbClient
import sh.measure.android.debug.DebugHeartbeatCollector
import sh.measure.android.events.DefaultTracker
import sh.measure.android.events.EventType
import sh.measure.android.events.MeasureEventFactory
import sh.measure.android.events.sinks.DbSink
import sh.measure.android.events.sinks.HttpSink
import sh.measure.android.events.sinks.LoggingSink
import sh.measure.android.exceptions.ExceptionData
import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.id.IdProvider
import sh.measure.android.id.UUIDProvider
import sh.measure.android.logger.Logger
import sh.measure.android.network.HttpClient
import sh.measure.android.network.HttpClientOkHttp
import sh.measure.android.resource.ResourceFactory
import sh.measure.android.resource.SessionProvider
import sh.measure.android.time.AndroidDateProvider
import sh.measure.android.time.DateProvider

/**
 * Maintains global state and provides a way for different components to communicate with each
 * other.
 */
internal class MeasureClient(private val logger: Logger, private val context: Context) {
    private val idProvider: IdProvider = UUIDProvider()
    private val dateProvider: DateProvider = AndroidDateProvider
    private val sessionProvider: SessionProvider = SessionProvider(idProvider)
    private val resource = ResourceFactory.create(logger, context, sessionProvider, Config)
    private val httpClient: HttpClient = HttpClientOkHttp(
        logger, baseUrl = Config.MEASURE_BASE_URL, secretToken = Config.MEASURE_SECRET_TOKEN
    )
    private val dbClient: DbClient = SqliteDbClient(logger, context)
    private val defaultTracker = DefaultTracker()

    fun init() {
        defaultTracker.apply {
            addEventSink(LoggingSink(logger))
            addEventSink(HttpSink(logger, httpClient, dbClient))
            addEventSink(DbSink(logger, dbClient))
        }
        UnhandledExceptionCollector(logger, this).register()
        DebugHeartbeatCollector(context, this).register()
    }

    fun captureException(exceptionData: ExceptionData) {
        val event = MeasureEventFactory.createMeasureEvent(
            type = EventType.EXCEPTION,
            value = Json.encodeToJsonElement(ExceptionData.serializer(), exceptionData),
            resource = resource,
            idProvider = idProvider,
            dateProvider = dateProvider
        )
        defaultTracker.track(event)
    }

    fun captureHeartbeat(string: String) {
        val event = MeasureEventFactory.createMeasureEvent(
            type = EventType.STRING,
            value = Json.encodeToJsonElement(String.serializer(), string),
            resource = resource,
            idProvider = idProvider,
            dateProvider = dateProvider
        )
        defaultTracker.track(event)
    }
}
