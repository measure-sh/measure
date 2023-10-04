package sh.measure.android

import android.content.Context
import sh.measure.android.events.MeasureEventTracker
import sh.measure.android.executors.MeasureExecutorServiceImpl
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
import sh.measure.android.storage.DbHelper
import sh.measure.android.storage.FileHelper
import sh.measure.android.storage.FileHelperImpl
import sh.measure.android.storage.SqliteDbHelper
import sh.measure.android.storage.Storage
import sh.measure.android.storage.StorageImpl
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.UUIDProvider

class Measure {
    companion object {
        fun init(context: Context) {
            checkMainThread()
            // TODO(abhay): Refactor this. This is a temporary entry point for initializing the
            //   Measure SDK.
            val logger = AndroidLogger().apply { log(LogLevel.Debug, "Initializing Measure") }
            val executorService = MeasureExecutorServiceImpl()
            val db: DbHelper = SqliteDbHelper(logger, context)
            val fileHelper: FileHelper = FileHelperImpl(logger, context)
            val storage: Storage = StorageImpl(logger, fileHelper, db)
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
                logger, sessionProvider, storage, transport, executorService
            )
            MeasureClient(
                logger,
                timeProvider = timeProvider,
                eventTracker = MeasureEventTracker(logger, sessionController),
                sessionController = sessionController,
            ).init()
        }
    }
}