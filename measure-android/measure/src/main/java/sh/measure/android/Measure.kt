package sh.measure.android

import android.app.Application
import android.content.Context
import androidx.annotation.VisibleForTesting
import sh.measure.android.anr.AnrCollector
import sh.measure.android.applaunch.AppLaunchCollector
import sh.measure.android.attachments.AttachmentProcessorImpl
import sh.measure.android.attachments.AttachmentStoreImpl
import sh.measure.android.attachments.MethodTraceImpl
import sh.measure.android.attributes.AppAttributeProcessor
import sh.measure.android.attributes.DeviceAttributeProcessor
import sh.measure.android.attributes.InstallationIdAttributeProcessor
import sh.measure.android.attributes.NetworkStateAttributeProcessor
import sh.measure.android.attributes.UserAttributeProcessor
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventProcessorImpl
import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.executors.CustomThreadFactory
import sh.measure.android.executors.MeasureExecutorServiceImpl
import sh.measure.android.gestures.GestureCollector
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
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.SystemServiceProviderImpl
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.UUIDProvider

object Measure {
    private lateinit var timeProvider: TimeProvider
    private lateinit var eventProcessor: EventProcessor
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
        timeProvider = AndroidTimeProvider()
        val idProvider = UUIDProvider()
        val systemServiceProvider: SystemServiceProvider = SystemServiceProviderImpl(context)
        val networkInfoProvider: NetworkInfoProvider =
            NetworkInfoProviderImpl(context, logger, systemServiceProvider)
        val localeProvider: LocaleProvider = LocaleProviderImpl()
        val pidProvider: PidProvider = PidProviderImpl()

        val prefsStorage: PrefsStorage = PrefsStorageImpl(context)
        val userIdAttributeGenerator = UserAttributeProcessor()
        val networkStateAttributeGenerator = NetworkStateAttributeProcessor(networkInfoProvider)
        val deviceAttributeGenerator = DeviceAttributeProcessor(logger, context, localeProvider)
        val appAttributeGenerator = AppAttributeProcessor(context)
        val installationIdAttributeGenerator =
            InstallationIdAttributeProcessor(prefsStorage, idProvider)

        val fileStorage: FileStorage = FileStorageImpl(context.filesDir.path, logger)
        val database: Database = DatabaseImpl(context, logger)
        val eventStorage = EventStoreImpl(
            logger, fileStorage, database, idProvider
        )

        val globalAttributeProcessors = listOf(
            userIdAttributeGenerator,
            networkStateAttributeGenerator,
            deviceAttributeGenerator,
            appAttributeGenerator,
            installationIdAttributeGenerator,
        )

        val attachmentProcessor = AttachmentProcessorImpl(
            logger,
            executorService,
            AttachmentStoreImpl(
                idProvider,
                database,
                fileStorage
            ),
            globalAttributeProcessors,
        )

        eventProcessor = EventProcessorImpl(
            logger,
            executorService,
            eventStorage,
            globalAttributeProcessors,
        )

        // Start cold launch trace, it ends in AppLaunchCollector
        val methodTrace = MethodTraceImpl(attachmentProcessor, timeProvider).apply {
            startColdLaunch()
        }

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
        val cpuUsageCollector = CpuUsageCollector(
            logger,
            eventProcessor,
            pidProvider,
            timeProvider,
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
            executorService,
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
            onAppForeground = {
                cpuUsageCollector.resume()
                memoryUsageCollector.resume()
            },
            onAppBackground = {
                cpuUsageCollector.pause()
                memoryUsageCollector.pause()
            },
        ).register()
        GestureCollector(logger, eventProcessor, timeProvider).register()
        AppLaunchCollector(
            logger,
            application,
            timeProvider,
            methodTrace,
            eventProcessor,
            coldLaunchListener = {
                NetworkChangesCollector(
                    context,
                    systemServiceProvider,
                    logger,
                    eventProcessor,
                    timeProvider,
                ).register()
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
}
