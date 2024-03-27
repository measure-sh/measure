package sh.measure.android

import android.app.Application
import android.content.Context
import androidx.annotation.VisibleForTesting
import sh.measure.android.anr.AnrCollector
import sh.measure.android.appexit.AppExitProvider
import sh.measure.android.appexit.AppExitProviderImpl
import sh.measure.android.applaunch.AppLaunchCollector
import sh.measure.android.applaunch.ColdLaunchTraceImpl
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.MeasureEventProcessor
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
import sh.measure.android.networkchange.NetworkChangesCollector
import sh.measure.android.networkchange.NetworkInfoProvider
import sh.measure.android.networkchange.NetworkInfoProviderImpl
import sh.measure.android.okhttp.OkHttpEventProcessor
import sh.measure.android.okhttp.OkHttpEventProcessorImpl
import sh.measure.android.performance.ComponentCallbacksCollector
import sh.measure.android.performance.CpuUsageCollector
import sh.measure.android.performance.DefaultMemoryReader
import sh.measure.android.performance.MemoryUsageCollector
import sh.measure.android.session.ResourceFactoryImpl
import sh.measure.android.session.SessionController
import sh.measure.android.session.SessionControllerImpl
import sh.measure.android.session.SessionProvider
import sh.measure.android.session.SessionReportGenerator
import sh.measure.android.storage.Storage
import sh.measure.android.storage.StorageImpl
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.CurrentThread
import sh.measure.android.utils.DefaultDebugProvider
import sh.measure.android.utils.DefaultRuntimeProvider
import sh.measure.android.utils.LocaleProvider
import sh.measure.android.utils.LocaleProviderImpl
import sh.measure.android.utils.ManifestReaderImpl
import sh.measure.android.utils.PidProvider
import sh.measure.android.utils.PidProviderImpl
import sh.measure.android.utils.ProcProviderImpl
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.SystemServiceProviderImpl
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.UUIDProvider

object Measure {
    private lateinit var timeProvider: TimeProvider
    private lateinit var eventProcessor: EventProcessor
    private lateinit var currentThread: CurrentThread
    private lateinit var okHttpEventProcessor: OkHttpEventProcessor

    fun init(context: Context) {
        InternalTrace.beginSection("Measure.init")
        checkMainThread()
        val application = context as Application

        val logger = AndroidLogger().apply { log(LogLevel.Debug, "Initializing Measure") }
        val manifestMetadata = ManifestReaderImpl(context, logger).load()
        if (manifestMetadata == null) {
            logger.log(LogLevel.Error, "Unable to initialize measure SDK")
            return
        } else if (manifestMetadata.url.isNullOrEmpty()) {
            logger.log(
                LogLevel.Error,
                "Unable to initialize measure SDK. measure_url is required in the manifest",
            )
            return
        } else if (manifestMetadata.apiKey.isNullOrEmpty()) {
            logger.log(
                LogLevel.Error,
                "Unable to initialize measure SDK. measure_api_key is required in the manifest",
            )
            return
        }
        val config = DefaultConfig()
        val customThreadFactory = CustomThreadFactory()
        val executorService = MeasureExecutorServiceImpl(customThreadFactory)
        val storage: Storage = StorageImpl(logger, context.filesDir.path)
        val httpClient: HttpClient =
            HttpClientOkHttp(logger, manifestMetadata.url, manifestMetadata.apiKey)
        val transport: Transport = TransportImpl(logger, httpClient)
        timeProvider = AndroidTimeProvider()
        val idProvider = UUIDProvider()
        val systemServiceProvider: SystemServiceProvider = SystemServiceProviderImpl(context)
        val networkInfoProvider: NetworkInfoProvider =
            NetworkInfoProviderImpl(context, logger, systemServiceProvider)
        val localeProvider: LocaleProvider = LocaleProviderImpl()
        val resourceFactory =
            ResourceFactoryImpl(logger, context, networkInfoProvider, localeProvider)
        currentThread = CurrentThread()
        val appExitProvider: AppExitProvider =
            AppExitProviderImpl(logger, currentThread, systemServiceProvider)
        val pidProvider: PidProvider = PidProviderImpl()
        val sessionReportGenerator = SessionReportGenerator(logger, storage, appExitProvider)
        val sessionProvider =
            SessionProvider(timeProvider, idProvider, pidProvider, resourceFactory)
        val sessionController: SessionController = SessionControllerImpl(
            logger,
            sessionProvider,
            storage,
            transport,
            executorService,
            sessionReportGenerator,
        )
        eventProcessor = MeasureEventProcessor(logger, sessionController)

        // Init session
        sessionController.initSession()

        // Start launch trace, this trace ends in the ColdLaunchCollector.
        val coldLaunchTrace = ColdLaunchTraceImpl(
            storage,
            sessionProvider.session.id,
            eventProcessor,
            timeProvider,
        ).apply { start() }

        // Register data collectors
        okHttpEventProcessor =
            OkHttpEventProcessorImpl(logger, eventProcessor, timeProvider, currentThread, config)
        UnhandledExceptionCollector(
            logger,
            eventProcessor,
            timeProvider,
            networkInfoProvider,
            localeProvider,
        ).register()
        AnrCollector(
            logger,
            systemServiceProvider,
            networkInfoProvider,
            timeProvider,
            eventProcessor,
            localeProvider,
        ).register()
        val cpuUsageCollector = CpuUsageCollector(
            logger,
            eventProcessor,
            pidProvider,
            timeProvider,
            currentThread,
            executorService,
        ).apply { register() }
        val memoryReader = DefaultMemoryReader(
            logger,
            DefaultDebugProvider(),
            DefaultRuntimeProvider(),
            pidProvider,
            ProcProviderImpl(),
        )
        val memoryUsageCollector = MemoryUsageCollector(
            eventProcessor,
            timeProvider,
            currentThread,
            executorService,
            memoryReader,
        ).apply { register() }
        ComponentCallbacksCollector(
            application,
            eventProcessor,
            timeProvider,
            currentThread,
            memoryReader,
        ).register()
        LifecycleCollector(
            context,
            eventProcessor,
            timeProvider,
            currentThread,
            onAppForeground = {
                cpuUsageCollector.resume()
                memoryUsageCollector.resume()
            },
            onAppBackground = {
                cpuUsageCollector.pause()
                memoryUsageCollector.pause()
            },
        ).register()
        GestureCollector(logger, eventProcessor, timeProvider, currentThread).register()
        AppLaunchCollector(
            logger,
            application,
            timeProvider,
            coldLaunchTrace,
            eventProcessor,
            coldLaunchListener = {
                NetworkChangesCollector(
                    context,
                    systemServiceProvider,
                    logger,
                    eventProcessor,
                    timeProvider,
                    currentThread,
                ).register()
                sessionController.syncAllSessions()
            },
        ).register()
        logger.log(LogLevel.Debug, "Measure initialization completed")
        InternalTrace.endSection()
    }

    internal fun getEventTracker(): EventProcessor {
        require(::eventProcessor.isInitialized)
        return eventProcessor
    }

    internal fun getTimeProvider(): TimeProvider {
        require(::timeProvider.isInitialized)
        return timeProvider
    }

    internal fun getCurrentThread(): CurrentThread {
        require(::currentThread.isInitialized)
        return currentThread
    }

    internal fun getOkHttpEventProcessor(): OkHttpEventProcessor {
        require(::okHttpEventProcessor.isInitialized)
        return okHttpEventProcessor
    }

    @VisibleForTesting
    internal fun setEventTracker(tracker: EventProcessor) {
        eventProcessor = tracker
    }

    @VisibleForTesting
    internal fun setTimeProvider(provider: TimeProvider) {
        timeProvider = provider
    }

    @VisibleForTesting
    internal fun setCurrentThread(thread: CurrentThread) {
        currentThread = thread
    }
}
