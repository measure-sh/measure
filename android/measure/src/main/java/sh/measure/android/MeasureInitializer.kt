package sh.measure.android

import android.app.Application
import sh.measure.android.anr.AnrCollector
import sh.measure.android.appexit.AppExitCollector
import sh.measure.android.appexit.AppExitProvider
import sh.measure.android.appexit.AppExitProviderImpl
import sh.measure.android.applaunch.AppLaunchCollector
import sh.measure.android.attributes.AppAttributeProcessor
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.attributes.DeviceAttributeProcessor
import sh.measure.android.attributes.InstallationIdAttributeProcessor
import sh.measure.android.attributes.NetworkStateAttributeProcessor
import sh.measure.android.attributes.PowerStateAttributeProcessor
import sh.measure.android.attributes.UserAttributeProcessor
import sh.measure.android.attributes.UserDefinedAttribute
import sh.measure.android.attributes.UserDefinedAttributeImpl
import sh.measure.android.config.Config
import sh.measure.android.config.ConfigLoaderImpl
import sh.measure.android.config.ConfigProvider
import sh.measure.android.config.ConfigProviderImpl
import sh.measure.android.config.MeasureConfig
import sh.measure.android.events.DefaultEventTransformer
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventProcessorImpl
import sh.measure.android.events.EventTransformer
import sh.measure.android.events.UserTriggeredEventCollector
import sh.measure.android.events.UserTriggeredEventCollectorImpl
import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.executors.ExecutorServiceRegistry
import sh.measure.android.executors.ExecutorServiceRegistryImpl
import sh.measure.android.exporter.BatchCreator
import sh.measure.android.exporter.BatchCreatorImpl
import sh.measure.android.exporter.EventExporter
import sh.measure.android.exporter.EventExporterImpl
import sh.measure.android.exporter.ExceptionExporter
import sh.measure.android.exporter.ExceptionExporterImpl
import sh.measure.android.exporter.Heartbeat
import sh.measure.android.exporter.HeartbeatImpl
import sh.measure.android.exporter.NetworkClient
import sh.measure.android.exporter.NetworkClientImpl
import sh.measure.android.exporter.PeriodicEventExporter
import sh.measure.android.exporter.PeriodicEventExporterImpl
import sh.measure.android.gestures.GestureCollector
import sh.measure.android.lifecycle.LifecycleCollector
import sh.measure.android.logger.AndroidLogger
import sh.measure.android.logger.Logger
import sh.measure.android.networkchange.InitialNetworkStateProvider
import sh.measure.android.networkchange.InitialNetworkStateProviderImpl
import sh.measure.android.networkchange.NetworkChangesCollector
import sh.measure.android.networkchange.NetworkStateProvider
import sh.measure.android.networkchange.NetworkStateProviderImpl
import sh.measure.android.okhttp.HttpEventCollector
import sh.measure.android.okhttp.HttpEventCollectorFactory
import sh.measure.android.performance.ComponentCallbacksCollector
import sh.measure.android.performance.CpuUsageCollector
import sh.measure.android.performance.DefaultMemoryReader
import sh.measure.android.performance.MemoryReader
import sh.measure.android.performance.MemoryUsageCollector
import sh.measure.android.screenshot.ScreenshotCollector
import sh.measure.android.screenshot.ScreenshotCollectorImpl
import sh.measure.android.storage.DataCleanupService
import sh.measure.android.storage.DataCleanupServiceImpl
import sh.measure.android.storage.Database
import sh.measure.android.storage.DatabaseImpl
import sh.measure.android.storage.EventStore
import sh.measure.android.storage.EventStoreImpl
import sh.measure.android.storage.FileStorage
import sh.measure.android.storage.FileStorageImpl
import sh.measure.android.storage.PrefsStorage
import sh.measure.android.storage.PrefsStorageImpl
import sh.measure.android.utils.AndroidSystemClock
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.DebugProvider
import sh.measure.android.utils.DefaultDebugProvider
import sh.measure.android.utils.DefaultRuntimeProvider
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.LocaleProvider
import sh.measure.android.utils.LocaleProviderImpl
import sh.measure.android.utils.LowMemoryCheck
import sh.measure.android.utils.ManifestReader
import sh.measure.android.utils.ManifestReaderImpl
import sh.measure.android.utils.OsSysConfProvider
import sh.measure.android.utils.OsSysConfProviderImpl
import sh.measure.android.utils.PackageInfoProviderImpl
import sh.measure.android.utils.ProcProvider
import sh.measure.android.utils.ProcProviderImpl
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.ProcessInfoProviderImpl
import sh.measure.android.utils.ResumedActivityProvider
import sh.measure.android.utils.ResumedActivityProviderImpl
import sh.measure.android.utils.RuntimeProvider
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.SystemServiceProviderImpl
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.UUIDProvider

internal class MeasureInitializerImpl(
    private val application: Application,
    inputConfig: MeasureConfig,
    override val configProvider: ConfigProvider = ConfigProviderImpl(
        defaultConfig = Config(
            enableLogging = inputConfig.enableLogging,
            trackScreenshotOnCrash = inputConfig.trackScreenshotOnCrash,
            screenshotMaskLevel = inputConfig.screenshotMaskLevel,
            trackHttpHeaders = inputConfig.trackHttpHeaders,
            trackHttpBody = inputConfig.trackHttpBody,
            httpHeadersBlocklist = inputConfig.httpHeadersBlocklist,
            httpUrlBlocklist = inputConfig.httpUrlBlocklist,
            httpUrlAllowlist = inputConfig.httpUrlAllowlist,
            trackActivityIntentData = inputConfig.trackActivityIntentData,
            sessionSamplingRate = inputConfig.sessionSamplingRate,
        ),
        configLoader = ConfigLoaderImpl(),
    ),
    override val logger: Logger = AndroidLogger(configProvider.enableLogging),
    override val timeProvider: TimeProvider = AndroidTimeProvider(AndroidSystemClock()),
    private val executorServiceRegistry: ExecutorServiceRegistry = ExecutorServiceRegistryImpl(),
    private val fileStorage: FileStorage = FileStorageImpl(
        rootDir = application.filesDir.path,
        logger = logger,
    ),
    private val database: Database = DatabaseImpl(context = application, logger = logger),
    override val manifestReader: ManifestReaderImpl = ManifestReaderImpl(application, logger),
    override val networkClient: NetworkClient = NetworkClientImpl(
        logger = logger,
        fileStorage = fileStorage,
    ),
    private val idProvider: IdProvider = UUIDProvider(),
    override val processInfoProvider: ProcessInfoProvider = ProcessInfoProviderImpl(),
    private val prefsStorage: PrefsStorage = PrefsStorageImpl(
        logger = logger,
        context = application,
    ),
    private val packageInfoProvider: PackageInfoProviderImpl = PackageInfoProviderImpl(application),
    override val sessionManager: SessionManager = SessionManagerImpl(
        logger = logger,
        timeProvider = timeProvider,
        database = database,
        prefs = prefsStorage,
        idProvider = idProvider,
        ioExecutor = executorServiceRegistry.ioExecutor(),
        processInfo = processInfoProvider,
        configProvider = configProvider,
        packageInfoProvider = packageInfoProvider,
    ),
    private val procProvider: ProcProvider = ProcProviderImpl(),
    private val debugProvider: DebugProvider = DefaultDebugProvider(),
    private val runtimeProvider: RuntimeProvider = DefaultRuntimeProvider(),
    private val osSysConfProvider: OsSysConfProvider = OsSysConfProviderImpl(),
    private val memoryReader: MemoryReader = DefaultMemoryReader(
        logger = logger,
        processInfo = processInfoProvider,
        procProvider = procProvider,
        debugProvider = debugProvider,
        runtimeProvider = runtimeProvider,
        osSysConfProvider = osSysConfProvider,
    ),
    private val localeProvider: LocaleProvider = LocaleProviderImpl(),
    private val systemServiceProvider: SystemServiceProvider = SystemServiceProviderImpl(application),
    private val initialNetworkStateProvider: InitialNetworkStateProvider = InitialNetworkStateProviderImpl(
        context = application,
        logger = logger,
        systemServiceProvider = systemServiceProvider,
    ),
    private val networkStateProvider: NetworkStateProvider = NetworkStateProviderImpl(
        initialNetworkStateProvider = initialNetworkStateProvider,
    ),
    override val powerStateProvider: PowerStateProvider = PowerStateProviderImpl(
        logger = logger,
        context = application,
        systemServiceProvider = systemServiceProvider,
    ),
    override val userDefinedAttribute: UserDefinedAttribute = UserDefinedAttributeImpl(
        logger,
        configProvider,
        database,
        executorServiceRegistry.ioExecutor(),
    ),
    override val userAttributeProcessor: UserAttributeProcessor = UserAttributeProcessor(
        logger,
        prefsStorage,
        executorServiceRegistry.ioExecutor(),
    ),
    private val deviceAttributeProcessor: DeviceAttributeProcessor = DeviceAttributeProcessor(
        logger,
        context = application,
        localeProvider = localeProvider,
        osSysConfProvider = osSysConfProvider,
    ),
    private val appAttributeProcessor: AppAttributeProcessor = AppAttributeProcessor(
        context = application,
        packageInfoProvider = packageInfoProvider,
    ),
    private val installationIdAttributeProcessor: InstallationIdAttributeProcessor = InstallationIdAttributeProcessor(
        prefsStorage = prefsStorage,
        idProvider = idProvider,
    ),
    private val networkStateAttributeProcessor: NetworkStateAttributeProcessor = NetworkStateAttributeProcessor(
        networkStateProvider = networkStateProvider,
    ),
    private val powerStateAttributeProcessor: PowerStateAttributeProcessor = PowerStateAttributeProcessor(
        powerStateProvider = powerStateProvider,
    ),
    private val attributeProcessors: List<AttributeProcessor> = listOf(
        userAttributeProcessor,
        deviceAttributeProcessor,
        appAttributeProcessor,
        installationIdAttributeProcessor,
        networkStateAttributeProcessor,
        powerStateAttributeProcessor,
    ),
    private val eventTransformer: EventTransformer = DefaultEventTransformer(
        configProvider = configProvider,
    ),
    private val eventStore: EventStore = EventStoreImpl(
        logger = logger,
        database = database,
        fileStorage = fileStorage,
        idProvider = idProvider,
    ),
    override val resumedActivityProvider: ResumedActivityProvider = ResumedActivityProviderImpl(
        application,
    ),
    private val lowMemoryCheck: LowMemoryCheck = LowMemoryCheck(
        activityManager = systemServiceProvider.activityManager,
    ),
    override val screenshotCollector: ScreenshotCollector = ScreenshotCollectorImpl(
        logger = logger,
        resumedActivityProvider = resumedActivityProvider,
        lowMemoryCheck = lowMemoryCheck,
        config = configProvider,
    ),
    private val batchCreator: BatchCreator = BatchCreatorImpl(
        logger = logger,
        timeProvider = timeProvider,
        database = database,
        configProvider = configProvider,
        idProvider = idProvider,
    ),
    private val eventExporter: EventExporter = EventExporterImpl(
        logger = logger,
        database = database,
        networkClient = networkClient,
        fileStorage = fileStorage,
        batchCreator = batchCreator,
    ),
    private val exceptionExporter: ExceptionExporter = ExceptionExporterImpl(
        logger = logger,
        exportExecutor = executorServiceRegistry.eventExportExecutor(),
        eventExporter = eventExporter,
    ),
    override val eventProcessor: EventProcessor = EventProcessorImpl(
        logger = logger,
        ioExecutor = executorServiceRegistry.ioExecutor(),
        eventStore = eventStore,
        idProvider = idProvider,
        sessionManager = sessionManager,
        attributeProcessors = attributeProcessors,
        exceptionExporter = exceptionExporter,
        screenshotCollector = screenshotCollector,
        eventTransformer = eventTransformer,
        configProvider = configProvider,
        userDefinedAttribute = userDefinedAttribute,
    ),
    override val userTriggeredEventCollector: UserTriggeredEventCollector = UserTriggeredEventCollectorImpl(
        eventProcessor = eventProcessor,
        timeProvider = timeProvider,
        processInfoProvider = processInfoProvider,
    ),
    private val periodicHeartbeat: Heartbeat = HeartbeatImpl(
        logger,
        executorServiceRegistry.defaultExecutor(),
    ),
    override val periodicEventExporter: PeriodicEventExporter = PeriodicEventExporterImpl(
        logger = logger,
        timeProvider = timeProvider,
        configProvider = configProvider,
        exportExecutor = executorServiceRegistry.eventExportExecutor(),
        heartbeat = periodicHeartbeat,
        eventExporter = eventExporter,
    ),
    private val httpEventCollectorFactory: HttpEventCollectorFactory = HttpEventCollectorFactory(
        logger = logger,
        eventProcessor = eventProcessor,
        timeProvider = timeProvider,
    ),
    override val httpEventCollector: HttpEventCollector = httpEventCollectorFactory.create(),
    override val unhandledExceptionCollector: UnhandledExceptionCollector = UnhandledExceptionCollector(
        logger = logger,
        timeProvider = timeProvider,
        eventProcessor = eventProcessor,
        processInfo = processInfoProvider,
    ),
    private val nativeBridgeImpl: NativeBridgeImpl = NativeBridgeImpl(logger),
    override val anrCollector: AnrCollector = AnrCollector(
        logger = logger,
        processInfo = processInfoProvider,
        eventProcessor = eventProcessor,
        nativeBridge = nativeBridgeImpl,
    ),
    private val appExitProvider: AppExitProvider = AppExitProviderImpl(
        logger = logger,
        systemServiceProvider = systemServiceProvider,
    ),
    override val appExitCollector: AppExitCollector = AppExitCollector(
        logger = logger,
        appExitProvider = appExitProvider,
        ioExecutor = executorServiceRegistry.ioExecutor(),
        eventProcessor = eventProcessor,
        sessionManager = sessionManager,
        database = database,
    ),
    override val cpuUsageCollector: CpuUsageCollector = CpuUsageCollector(
        logger = logger,
        timeProvider = timeProvider,
        eventProcessor = eventProcessor,
        processInfo = processInfoProvider,
        procProvider = procProvider,
        osSysConfProvider = osSysConfProvider,
        defaultExecutor = executorServiceRegistry.defaultExecutor(),
    ),
    override val memoryUsageCollector: MemoryUsageCollector = MemoryUsageCollector(
        logger = logger,
        eventProcessor = eventProcessor,
        timeProvider = timeProvider,
        defaultExecutor = executorServiceRegistry.defaultExecutor(),
        memoryReader = memoryReader,
        processInfo = processInfoProvider,
    ),
    override val componentCallbacksCollector: ComponentCallbacksCollector = ComponentCallbacksCollector(
        application = application,
        timeProvider = timeProvider,
        eventProcessor = eventProcessor,
    ),
    override val lifecycleCollector: LifecycleCollector = LifecycleCollector(
        application = application,
        eventProcessor = eventProcessor,
        timeProvider = timeProvider,
    ),
    override val gestureCollector: GestureCollector = GestureCollector(
        logger = logger,
        eventProcessor = eventProcessor,
        timeProvider = timeProvider,
    ),
    override val appLaunchCollector: AppLaunchCollector = AppLaunchCollector(
        logger = logger,
        application = application,
        eventProcessor = eventProcessor,
        timeProvider = timeProvider,
    ),
    override val networkChangesCollector: NetworkChangesCollector = NetworkChangesCollector(
        logger = logger,
        context = application,
        eventProcessor = eventProcessor,
        systemServiceProvider = systemServiceProvider,
        timeProvider = timeProvider,
        networkStateProvider = networkStateProvider,
    ),
    override val dataCleanupService: DataCleanupService = DataCleanupServiceImpl(
        logger = logger,
        fileStorage = fileStorage,
        database = database,
        ioExecutor = executorServiceRegistry.ioExecutor(),
        sessionManager = sessionManager,
        configProvider = configProvider,
    ),
) : MeasureInitializer

internal interface MeasureInitializer {
    val logger: Logger
    val timeProvider: TimeProvider
    val networkClient: NetworkClient
    val configProvider: ConfigProvider
    val manifestReader: ManifestReader
    val resumedActivityProvider: ResumedActivityProvider
    val eventProcessor: EventProcessor
    val userTriggeredEventCollector: UserTriggeredEventCollector
    val httpEventCollector: HttpEventCollector
    val sessionManager: SessionManager
    val unhandledExceptionCollector: UnhandledExceptionCollector
    val anrCollector: AnrCollector
    val appExitCollector: AppExitCollector
    val cpuUsageCollector: CpuUsageCollector
    val memoryUsageCollector: MemoryUsageCollector
    val componentCallbacksCollector: ComponentCallbacksCollector
    val lifecycleCollector: LifecycleCollector
    val gestureCollector: GestureCollector
    val appLaunchCollector: AppLaunchCollector
    val networkChangesCollector: NetworkChangesCollector
    val periodicEventExporter: PeriodicEventExporter
    val userAttributeProcessor: UserAttributeProcessor
    val userDefinedAttribute: UserDefinedAttribute
    val screenshotCollector: ScreenshotCollector
    val dataCleanupService: DataCleanupService
    val processInfoProvider: ProcessInfoProvider
    val powerStateProvider: PowerStateProvider
}
