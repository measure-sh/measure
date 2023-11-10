package sh.measure.android

import android.app.Application
import android.content.Context
import sh.measure.android.anr.AnrCollector
import sh.measure.android.app_launch.AppLaunchCollector
import sh.measure.android.app_launch.ColdLaunchTraceImpl
import sh.measure.android.appexit.AppExitProvider
import sh.measure.android.appexit.AppExitProviderImpl
import sh.measure.android.events.EventTracker
import sh.measure.android.events.MeasureEventTracker
import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.executors.MeasureExecutorServiceImpl
import sh.measure.android.gestures.GestureCollector
import sh.measure.android.lifecycle.LifecycleCollector
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
import sh.measure.android.storage.Storage
import sh.measure.android.storage.StorageImpl
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.PidProvider
import sh.measure.android.utils.PidProviderImpl
import sh.measure.android.utils.UUIDProvider

object Measure {
    fun init(context: Context) {
        checkMainThread()
        val application = context as Application

        val logger = AndroidLogger().apply { log(LogLevel.Debug, "Initializing Measure") }
        val executorService = MeasureExecutorServiceImpl()
        val storage: Storage = StorageImpl(logger, context.filesDir.path)
        val httpClient: HttpClient =
            HttpClientOkHttp(logger, Config.MEASURE_BASE_URL, Config.MEASURE_SECRET_TOKEN)
        val transport: Transport = TransportImpl(logger, httpClient)
        val timeProvider = AndroidTimeProvider()
        val idProvider = UUIDProvider()
        val config = Config
        val resourceFactory = ResourceFactoryImpl(logger, context, config)
        val currentThread = CurrentThread()
        val appExitProvider: AppExitProvider = AppExitProviderImpl(context, logger, currentThread)
        val pidProvider: PidProvider = PidProviderImpl()
        val sessionReportGenerator = SessionReportGenerator(logger, storage, appExitProvider)
        val sessionProvider =
            SessionProvider(timeProvider, idProvider, pidProvider, resourceFactory)
        val sessionController: SessionController = SessionControllerImpl(
            logger, sessionProvider, storage, transport, executorService, sessionReportGenerator
        )
        val eventTracker: EventTracker = MeasureEventTracker(logger, sessionController)

        // Init session
        sessionController.initSession()

        // Start launch trace, this trace ends in the ColdLaunchCollector.
        val coldLaunchTrace = ColdLaunchTraceImpl(
            storage, sessionProvider.session.id, eventTracker, timeProvider
        ).apply { start() }

        // Register data collectors
        UnhandledExceptionCollector(logger, eventTracker, timeProvider).register()
        AnrCollector(logger, context, timeProvider, eventTracker).register()
        AppLaunchCollector(
            logger, application, timeProvider, coldLaunchTrace, eventTracker,
            coldLaunchListener = {
                LifecycleCollector(context, eventTracker, timeProvider, currentThread).register()
                GestureCollector(logger, eventTracker, timeProvider, currentThread).register()
                sessionController.syncAllSessions()
            },
        ).register()
        logger.log(LogLevel.Debug, "Measure initialization completed")
    }
}