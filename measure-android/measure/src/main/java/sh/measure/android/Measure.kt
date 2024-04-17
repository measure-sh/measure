package sh.measure.android

import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import androidx.annotation.VisibleForTesting
import sh.measure.android.anr.AnrCollector
import sh.measure.android.applaunch.AppLaunchCollector
import sh.measure.android.applaunch.ColdLaunchListener
import sh.measure.android.attributes.AppAttributeProcessor
import sh.measure.android.attributes.DeviceAttributeProcessor
import sh.measure.android.attributes.InstallationIdAttributeProcessor
import sh.measure.android.attributes.NetworkStateAttributeProcessor
import sh.measure.android.attributes.UserAttributeProcessor
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventProcessorImpl
import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.executors.ExecutorServiceRegistryImpl
import sh.measure.android.exporter.NetworkClient
import sh.measure.android.exporter.NetworkClientImpl
import sh.measure.android.exporter.PeriodicEventExporter
import sh.measure.android.exporter.PeriodicEventExporterImpl
import sh.measure.android.gestures.GestureCollector
import sh.measure.android.lifecycle.ApplicationLifecycleStateListener
import sh.measure.android.lifecycle.LifecycleCollector
import sh.measure.android.logger.AndroidLogger
import sh.measure.android.logger.LogLevel
import sh.measure.android.networkchange.NetworkChangesCollector
import sh.measure.android.networkchange.NetworkInfoProvider
import sh.measure.android.networkchange.NetworkInfoProviderImpl
import sh.measure.android.okhttp.OkHttpEventProcessor
import sh.measure.android.okhttp.OkHttpEventProcessorImpl
import sh.measure.android.performance.ComponentCallbacksCollector
import sh.measure.android.performance.CpuUsageCollector
import sh.measure.android.performance.DefaultMemoryReader
import sh.measure.android.performance.MemoryUsageCollector
import sh.measure.android.storage.Database
import sh.measure.android.storage.DatabaseImpl
import sh.measure.android.storage.EventStoreImpl
import sh.measure.android.storage.FileStorage
import sh.measure.android.storage.FileStorageImpl
import sh.measure.android.storage.PrefsStorage
import sh.measure.android.storage.PrefsStorageImpl
import sh.measure.android.tracing.InternalTrace
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.DefaultDebugProvider
import sh.measure.android.utils.DefaultRuntimeProvider
import sh.measure.android.utils.LocaleProvider
import sh.measure.android.utils.LocaleProviderImpl
import sh.measure.android.utils.ManifestReaderImpl
import sh.measure.android.utils.PidProvider
import sh.measure.android.utils.PidProviderImpl
import sh.measure.android.utils.ProcProviderImpl
import sh.measure.android.utils.SessionIdProviderImpl
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.SystemServiceProviderImpl
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.UUIDProvider

object Measure : ColdLaunchListener, ApplicationLifecycleStateListener {
    private lateinit var timeProvider: TimeProvider
    private lateinit var eventProcessor: EventProcessor
    private lateinit var okHttpEventProcessor: OkHttpEventProcessor
    private lateinit var userAttributeProcessor: UserAttributeProcessor

    @SuppressLint("StaticFieldLeak") // TODO: to be fixed when Measure is refactored
    private lateinit var networkChangesCollector: NetworkChangesCollector
    private lateinit var cpuUsageCollector: CpuUsageCollector
    private lateinit var memoryUsageCollector: MemoryUsageCollector
    private lateinit var periodicEventExporter: PeriodicEventExporter

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
        val executorServiceRegistry = ExecutorServiceRegistryImpl()
        timeProvider = AndroidTimeProvider()
        val idProvider = UUIDProvider()
        val systemServiceProvider: SystemServiceProvider = SystemServiceProviderImpl(context)
        val networkInfoProvider: NetworkInfoProvider =
            NetworkInfoProviderImpl(context, logger, systemServiceProvider)
        val localeProvider: LocaleProvider = LocaleProviderImpl()
        val pidProvider: PidProvider = PidProviderImpl()

        val prefsStorage: PrefsStorage = PrefsStorageImpl(context)
        userAttributeProcessor = UserAttributeProcessor()
        val networkStateAttributeProcessor = NetworkStateAttributeProcessor(networkInfoProvider)
        val deviceAttributeProcessor = DeviceAttributeProcessor(logger, context, localeProvider)
        val appAttributeProcessor = AppAttributeProcessor(context)
        val installationIdAttributeProcessor =
            InstallationIdAttributeProcessor(prefsStorage, idProvider)

        val sessionIdProvider = SessionIdProviderImpl(idProvider)
        val fileStorage: FileStorage = FileStorageImpl(context.filesDir.path, logger)
        val database: Database = DatabaseImpl(context, logger)
        val eventStorage = EventStoreImpl(
            logger,
            fileStorage,
            database,
            idProvider,
            sessionIdProvider,
        )

        val globalAttributeProcessors = listOf(
            userAttributeProcessor,
            networkStateAttributeProcessor,
            deviceAttributeProcessor,
            appAttributeProcessor,
            installationIdAttributeProcessor,
        )

        eventProcessor = EventProcessorImpl(
            logger,
            executorServiceRegistry.eventProcessorExecutor(),
            eventStorage,
            globalAttributeProcessors,
        )

        val networkClient: NetworkClient =
            NetworkClientImpl(logger, fileStorage, manifestMetadata.apiKey, manifestMetadata.url)

        periodicEventExporter = PeriodicEventExporterImpl(
            logger,
            config,
            idProvider,
            heartbeatExecutorService = executorServiceRegistry.exportHeartbeatExecutor(),
            exportExecutorService = executorServiceRegistry.eventExportExecutor(),
            database,
            networkClient,
            timeProvider,
        )

        // Register data collectors
        okHttpEventProcessor =
            OkHttpEventProcessorImpl(logger, eventProcessor, timeProvider, config)
        UnhandledExceptionCollector(
            logger,
            eventProcessor,
            timeProvider,
        ).register()
        AnrCollector(
            logger,
            systemServiceProvider,
            timeProvider,
            eventProcessor,
        ).register()
        cpuUsageCollector = CpuUsageCollector(
            logger,
            eventProcessor,
            pidProvider,
            timeProvider,
            executorServiceRegistry.cpuAndMemoryCollectionExecutor(),
        ).apply { register() }
        val memoryReader = DefaultMemoryReader(
            logger,
            DefaultDebugProvider(),
            DefaultRuntimeProvider(),
            pidProvider,
            ProcProviderImpl(),
        )
        memoryUsageCollector = MemoryUsageCollector(
            eventProcessor,
            timeProvider,
            executorServiceRegistry.cpuAndMemoryCollectionExecutor(),
            memoryReader,
        ).apply { register() }
        ComponentCallbacksCollector(
            application,
            eventProcessor,
            timeProvider,
            memoryReader,
        ).register()
        LifecycleCollector(
            context,
            eventProcessor,
            timeProvider,
            this,
        ).register()
        GestureCollector(logger, eventProcessor, timeProvider).register()
        AppLaunchCollector(
            logger,
            application,
            timeProvider,
            eventProcessor,
            coldLaunchListener = this,
        ).register()

        networkChangesCollector = NetworkChangesCollector(
            context,
            systemServiceProvider,
            logger,
            eventProcessor,
            timeProvider,
        )

        logger.log(LogLevel.Debug, "Measure initialization completed")
        InternalTrace.endSection()
    }

    fun setUserId(userId: String) {
        require(::userAttributeProcessor.isInitialized)
        userAttributeProcessor.setUserId(userId)
    }

    internal fun getEventTracker(): EventProcessor {
        require(::eventProcessor.isInitialized)
        return eventProcessor
    }

    internal fun getTimeProvider(): TimeProvider {
        require(::timeProvider.isInitialized)
        return timeProvider
    }

    internal fun getOkHttpEventProcessor(): OkHttpEventProcessor {
        require(::okHttpEventProcessor.isInitialized)
        return okHttpEventProcessor
    }

    @VisibleForTesting
    internal fun setEventProcessor(tracker: EventProcessor) {
        eventProcessor = tracker
    }

    @VisibleForTesting
    internal fun setTimeProvider(provider: TimeProvider) {
        timeProvider = provider
    }

    override fun onColdLaunch() {
        require(::networkChangesCollector.isInitialized)
        networkChangesCollector.register()
        periodicEventExporter.onColdLaunch()
    }

    override fun onAppForeground() {
        require(::cpuUsageCollector.isInitialized)
        require(::memoryUsageCollector.isInitialized)
        require(::periodicEventExporter.isInitialized)
        cpuUsageCollector.resume()
        memoryUsageCollector.resume()
        periodicEventExporter.onAppForeground()
    }

    override fun onAppBackground() {
        require(::cpuUsageCollector.isInitialized)
        require(::memoryUsageCollector.isInitialized)
        require(::periodicEventExporter.isInitialized)
        cpuUsageCollector.pause()
        memoryUsageCollector.pause()
        periodicEventExporter.onAppBackground()
    }
}
