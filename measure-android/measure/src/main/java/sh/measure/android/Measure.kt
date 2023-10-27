package sh.measure.android

import android.content.Context
import sh.measure.android.appexit.AppExitProvider
import sh.measure.android.appexit.AppExitProviderImpl
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
import sh.measure.android.session.SessionReportGenerator
import sh.measure.android.storage.FileHelper
import sh.measure.android.storage.FileHelperImpl
import sh.measure.android.storage.Storage
import sh.measure.android.storage.StorageImpl
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.PidProvider
import sh.measure.android.utils.PidProviderImpl
import sh.measure.android.utils.UUIDProvider

object Measure {
    fun init(context: Context) {
        checkMainThread()
        val logger = AndroidLogger().apply { log(LogLevel.Debug, "Initializing Measure") }
        val executorService = MeasureExecutorServiceImpl()
        val fileHelper: FileHelper = FileHelperImpl(logger, context)
        val storage: Storage = StorageImpl(logger, fileHelper)
        val httpClient: HttpClient =
            HttpClientOkHttp(logger, Config.MEASURE_BASE_URL, Config.MEASURE_SECRET_TOKEN)
        val transport: Transport = TransportImpl(logger, httpClient)
        val timeProvider = AndroidTimeProvider()
        val idProvider = UUIDProvider()
        val config = Config
        val resourceFactory = ResourceFactoryImpl(logger, context, config)
        val appExitProvider: AppExitProvider = AppExitProviderImpl(context, logger)
        val pidProvider: PidProvider = PidProviderImpl()
        val sessionReportGenerator = SessionReportGenerator(logger, storage, appExitProvider)
        val sessionProvider =
            SessionProvider(timeProvider, idProvider, pidProvider, resourceFactory)
        val sessionController: SessionController = SessionControllerImpl(
            logger, sessionProvider, storage, transport, executorService, sessionReportGenerator
        )
        MeasureClient(
            logger,
            context = context,
            timeProvider = timeProvider,
            eventTracker = MeasureEventTracker(logger, sessionController),
            sessionController = sessionController,
        ).init()
    }
}