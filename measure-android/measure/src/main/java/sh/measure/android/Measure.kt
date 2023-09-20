package sh.measure.android

import android.content.Context
import sh.measure.android.executors.BackgroundTaskRunner
import sh.measure.android.executors.CustomThreadFactory
import sh.measure.android.id.UUIDProvider
import sh.measure.android.logger.AndroidLogger
import sh.measure.android.logger.LogLevel
import sh.measure.android.network.HttpClient
import sh.measure.android.network.HttpClientOkHttp
import sh.measure.android.network.Transport
import sh.measure.android.network.TransportImpl
import sh.measure.android.session.ResourceFactoryImpl
import sh.measure.android.session.SessionController
import sh.measure.android.session.SessionControllerImpl
import sh.measure.android.session.SessionProvider
import sh.measure.android.storage.SqliteDbHelper
import sh.measure.android.storage.Storage
import sh.measure.android.storage.StorageImpl
import sh.measure.android.time.AndroidTimeProvider
import sh.measure.android.tracker.MeasureSignalTracker

class Measure {
    companion object {
        fun init(context: Context) {
            // TODO(abhay): Refactor this. This is a temporary entry point for initializing the
            //   Measure SDK.
            val logger = AndroidLogger().apply { log(LogLevel.Debug, "Initializing Measure") }
            val threadFactory = CustomThreadFactory()
            val backgroundTaskRunner = BackgroundTaskRunner(threadFactory)
            val storage: Storage = StorageImpl(logger, SqliteDbHelper(logger, context))
            val httpClient: HttpClient =
                HttpClientOkHttp(logger, Config.MEASURE_BASE_URL, Config.MEASURE_SECRET_TOKEN)
            val transport: Transport =
                TransportImpl(logger, httpClient)
            val timeProvider = AndroidTimeProvider()
            val idProvider = UUIDProvider()
            val config = Config
            val resourceFactory = ResourceFactoryImpl(logger, context, config)
            val sessionProvider = SessionProvider(
                logger, timeProvider, idProvider, resourceFactory
            )
            val sessionController: SessionController = SessionControllerImpl(
                logger, sessionProvider, storage, transport, backgroundTaskRunner
            )
            MeasureClient(
                logger,
                timeProvider = timeProvider,
                signalTracker = MeasureSignalTracker(logger, sessionController),
                sessionController = sessionController,
            ).init()
        }
    }
}