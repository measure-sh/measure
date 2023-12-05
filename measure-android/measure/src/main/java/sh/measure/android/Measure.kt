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
import sh.measure.android.executors.CustomThreadFactory
import sh.measure.android.executors.MeasureExecutorServiceImpl
import sh.measure.android.gestures.GestureCollector
import sh.measure.android.lifecycle.LifecycleCollector
import sh.measure.android.logger.AndroidLogger
import sh.measure.android.logger.LogLevel
import sh.measure.android.network.HttpClient
import sh.measure.android.network.HttpClientOkHttp
import sh.measure.android.network.Transport
import sh.measure.android.network.TransportImpl
import sh.measure.android.network_change.NetworkChangesCollector
import sh.measure.android.network_change.NetworkInfoProvider
import sh.measure.android.network_change.NetworkInfoProviderImpl
import sh.measure.android.performance.ComponentCallbacksCollector
import sh.measure.android.performance.CpuUsageCollector
import sh.measure.android.performance.MemoryUsageCollector
import sh.measure.android.session.ResourceFactoryImpl
import sh.measure.android.session.SessionController
import sh.measure.android.session.SessionControllerImpl
import sh.measure.android.session.SessionProvider
import sh.measure.android.session.SessionReportGenerator
import sh.measure.android.storage.Storage
import sh.measure.android.storage.StorageImpl
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.LocaleProvider
import sh.measure.android.utils.LocaleProviderImpl
import sh.measure.android.utils.PidProvider
import sh.measure.android.utils.PidProviderImpl
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.SystemServiceProviderImpl
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.UUIDProvider

object Measure {
    private lateinit var timeProvider: TimeProvider
    private lateinit var eventTracker: EventTracker
    private lateinit var currentThread: CurrentThread

    fun init(context: Context) {
        checkMainThread()
        val application = context as Application

        val logger = AndroidLogger().apply { log(LogLevel.Debug, "Initializing Measure") }
        val customThreadFactory = CustomThreadFactory()
        val executorService = MeasureExecutorServiceImpl(customThreadFactory)
        val storage: Storage = StorageImpl(logger, context.filesDir.path)
        val httpClient: HttpClient =
            HttpClientOkHttp(logger, Config.MEASURE_BASE_URL, Config.MEASURE_SECRET_TOKEN)
        val transport: Transport = TransportImpl(logger, httpClient)
        timeProvider = AndroidTimeProvider()
        val idProvider = UUIDProvider()
        val config = Config
        val systemServiceProvider: SystemServiceProvider = SystemServiceProviderImpl(context)
        val networkInfoProvider: NetworkInfoProvider =
            NetworkInfoProviderImpl(context, logger, systemServiceProvider)
        val localeProvider: LocaleProvider = LocaleProviderImpl()
        val resourceFactory = ResourceFactoryImpl(logger, context, config, networkInfoProvider, localeProvider)
        currentThread = CurrentThread()
        val appExitProvider: AppExitProvider =
            AppExitProviderImpl(logger, currentThread, systemServiceProvider)
        val pidProvider: PidProvider = PidProviderImpl()
        val sessionReportGenerator = SessionReportGenerator(logger, storage, appExitProvider)
        val sessionProvider =
            SessionProvider(timeProvider, idProvider, pidProvider, resourceFactory)
        val sessionController: SessionController = SessionControllerImpl(
            logger, sessionProvider, storage, transport, executorService, sessionReportGenerator
        )
        eventTracker = MeasureEventTracker(logger, sessionController)

        // Init session
        sessionController.initSession()

        // Start launch trace, this trace ends in the ColdLaunchCollector.
        val coldLaunchTrace = ColdLaunchTraceImpl(
            storage, sessionProvider.session.id, eventTracker, timeProvider
        ).apply { start() }

        // Register data collectors
        UnhandledExceptionCollector(logger, eventTracker, timeProvider, networkInfoProvider, localeProvider).register()
        AnrCollector(logger, systemServiceProvider, networkInfoProvider, timeProvider, eventTracker, localeProvider)
            .register()
        val cpuUsageCollector = CpuUsageCollector(logger, eventTracker, pidProvider, timeProvider, currentThread, executorService).apply { register() }
        val memoryUsageCollector = MemoryUsageCollector(logger, pidProvider, eventTracker, timeProvider, currentThread, executorService).apply { register() }
        ComponentCallbacksCollector(application, eventTracker, timeProvider, currentThread).register()
        LifecycleCollector(
            context,
            eventTracker,
            timeProvider,
            currentThread,
            onAppForeground = {
                cpuUsageCollector.resume()
                memoryUsageCollector.resume()
            },
            onAppBackground = {
                cpuUsageCollector.pause()
                memoryUsageCollector.pause()
            }).register()

        AppLaunchCollector(
            logger, application, timeProvider, coldLaunchTrace, eventTracker,
            coldLaunchListener = {
                GestureCollector(logger, eventTracker, timeProvider, currentThread).register()
                NetworkChangesCollector(
                    context,
                    systemServiceProvider,
                    logger,
                    eventTracker,
                    timeProvider,
                    currentThread
                ).register()
                sessionController.syncAllSessions()
            },
        ).register()
        logger.log(LogLevel.Debug, "Measure initialization completed")
    }

    internal fun getEventTracker(): EventTracker {
        require(::eventTracker.isInitialized)
        return eventTracker
    }

    internal fun getTimeProvider(): TimeProvider {
        require(::timeProvider.isInitialized)
        return timeProvider
    }

    internal fun getCurrentThread(): CurrentThread {
        require(::currentThread.isInitialized)
        return currentThread
    }
}