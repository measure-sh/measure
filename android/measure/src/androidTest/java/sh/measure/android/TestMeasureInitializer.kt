package sh.measure.android

import android.app.Application
import sh.measure.android.anr.AnrCollector
import sh.measure.android.appexit.AppExitCollector
import sh.measure.android.appexit.AppExitProvider
import sh.measure.android.appexit.AppExitProviderImpl
import sh.measure.android.applaunch.AppLaunchCollector
import sh.measure.android.applaunch.LaunchTracker
import sh.measure.android.attributes.AppAttributeProcessor
import sh.measure.android.attributes.AttributeProcessor
import sh.measure.android.attributes.DeviceAttributeProcessor
import sh.measure.android.attributes.InstallationIdAttributeProcessor
import sh.measure.android.attributes.NetworkStateAttributeProcessor
import sh.measure.android.attributes.PowerStateAttributeProcessor
import sh.measure.android.attributes.UserAttributeProcessor
import sh.measure.android.bugreport.AccelerometerShakeDetector
import sh.measure.android.bugreport.BugReportCollector
import sh.measure.android.bugreport.BugReportCollectorImpl
import sh.measure.android.bugreport.ShakeBugReportCollector
import sh.measure.android.config.Config
import sh.measure.android.config.ConfigLoaderImpl
import sh.measure.android.config.ConfigProvider
import sh.measure.android.config.ConfigProviderImpl
import sh.measure.android.config.MeasureConfig
import sh.measure.android.events.CustomEventCollector
import sh.measure.android.events.InternalSignalCollector
import sh.measure.android.events.SignalProcessor
import sh.measure.android.events.SignalProcessorImpl
import sh.measure.android.events.UserTriggeredEventCollector
import sh.measure.android.events.UserTriggeredEventCollectorImpl
import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.executors.ExecutorServiceRegistry
import sh.measure.android.executors.ExecutorServiceRegistryImpl
import sh.measure.android.exporter.BatchCreator
import sh.measure.android.exporter.BatchCreatorImpl
import sh.measure.android.exporter.ExceptionExporter
import sh.measure.android.exporter.ExceptionExporterImpl
import sh.measure.android.exporter.Exporter
import sh.measure.android.exporter.ExporterImpl
import sh.measure.android.exporter.NetworkClient
import sh.measure.android.exporter.NetworkClientImpl
import sh.measure.android.exporter.PeriodicExporter
import sh.measure.android.gestures.GestureCollector
import sh.measure.android.layoutinspector.LayoutSnapshotThrottler
import sh.measure.android.lifecycle.AppLifecycleCollector
import sh.measure.android.lifecycle.AppLifecycleManager
import sh.measure.android.lifecycle.DefaultActivityLifecycleCollector
import sh.measure.android.logger.AndroidLogger
import sh.measure.android.logger.Logger
import sh.measure.android.networkchange.InitialNetworkStateProvider
import sh.measure.android.networkchange.InitialNetworkStateProviderImpl
import sh.measure.android.networkchange.NetworkChangesCollector
import sh.measure.android.networkchange.NetworkStateProvider
import sh.measure.android.networkchange.NetworkStateProviderImpl
import sh.measure.android.okhttp.HttpEventCollector
import sh.measure.android.okhttp.OkHttpEventCollectorImpl
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
import sh.measure.android.storage.FileStorage
import sh.measure.android.storage.FileStorageImpl
import sh.measure.android.storage.PeriodicSignalStoreScheduler
import sh.measure.android.storage.PrefsStorage
import sh.measure.android.storage.PrefsStorageImpl
import sh.measure.android.storage.SignalStore
import sh.measure.android.storage.SignalStoreImpl
import sh.measure.android.tracing.MsrSpanProcessor
import sh.measure.android.tracing.MsrTracer
import sh.measure.android.tracing.SpanCollector
import sh.measure.android.tracing.SpanProcessor
import sh.measure.android.tracing.TraceSampler
import sh.measure.android.tracing.TraceSamplerImpl
import sh.measure.android.tracing.Tracer
import sh.measure.android.utils.AndroidSystemClock
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.DebugProvider
import sh.measure.android.utils.DefaultDebugProvider
import sh.measure.android.utils.DefaultRuntimeProvider
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.IdProviderImpl
import sh.measure.android.utils.LocaleProvider
import sh.measure.android.utils.LocaleProviderImpl
import sh.measure.android.utils.LowMemoryCheck
import sh.measure.android.utils.ManifestReaderImpl
import sh.measure.android.utils.OsSysConfProvider
import sh.measure.android.utils.OsSysConfProviderImpl
import sh.measure.android.utils.PackageInfoProvider
import sh.measure.android.utils.PackageInfoProviderImpl
import sh.measure.android.utils.ProcProvider
import sh.measure.android.utils.ProcProviderImpl
import sh.measure.android.utils.ProcessInfoProvider
import sh.measure.android.utils.ProcessInfoProviderImpl
import sh.measure.android.utils.Randomizer
import sh.measure.android.utils.RandomizerImpl
import sh.measure.android.utils.ResumedActivityProvider
import sh.measure.android.utils.ResumedActivityProviderImpl
import sh.measure.android.utils.RuntimeProvider
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.SystemServiceProviderImpl
import sh.measure.android.utils.TimeProvider

internal class TestMeasureInitializer(
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
            samplingRateForErrorFreeSessions = inputConfig.samplingRateForErrorFreeSessions,
            requestHeadersProvider = inputConfig.requestHeadersProvider,
        ),
        configLoader = ConfigLoaderImpl(),
    ),
    override val logger: Logger = AndroidLogger(configProvider.enableLogging),
    override val timeProvider: TimeProvider = AndroidTimeProvider(AndroidSystemClock()),
    override val executorServiceRegistry: ExecutorServiceRegistry = ExecutorServiceRegistryImpl(),
    private val fileStorage: FileStorage = FileStorageImpl(
        rootDir = application.filesDir.path,
        logger = logger,
    ),
    private val database: Database = DatabaseImpl(context = application, logger = logger),
    override val manifestReader: ManifestReaderImpl = ManifestReaderImpl(application, logger),
    override val networkClient: NetworkClient = NetworkClientImpl(
        logger = logger,
        fileStorage = fileStorage,
        configProvider = configProvider,
    ),
    private val randomizer: Randomizer = RandomizerImpl(),
    private val idProvider: IdProvider = IdProviderImpl(randomizer),
    override val processInfoProvider: ProcessInfoProvider = ProcessInfoProviderImpl(),
    private val prefsStorage: PrefsStorage = PrefsStorageImpl(
        context = application,
    ),
    private val packageInfoProvider: PackageInfoProvider = PackageInfoProviderImpl(application),
    override val sessionManager: SessionManager = SessionManagerImpl(
        logger = logger,
        idProvider = idProvider,
        database = database,
        prefs = prefsStorage,
        processInfo = processInfoProvider,
        timeProvider = timeProvider,
        configProvider = configProvider,
        ioExecutor = executorServiceRegistry.ioExecutor(),
        packageInfoProvider = packageInfoProvider,
        randomizer = randomizer,
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
    override val userAttributeProcessor: UserAttributeProcessor = UserAttributeProcessor(
        logger,
        prefsStorage,
        executorServiceRegistry.ioExecutor(),
    ),
    private val deviceAttributeProcessor: DeviceAttributeProcessor = DeviceAttributeProcessor(
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
    override val powerStateProvider: PowerStateProvider = PowerStateProviderImpl(
        logger = logger,
        context = application,
        systemServiceProvider = systemServiceProvider,
    ),
    private val powerStateAttributeProcessor: PowerStateAttributeProcessor = PowerStateAttributeProcessor(
        powerStateProvider,
    ),
    private val attributeProcessors: List<AttributeProcessor> = listOf(
        userAttributeProcessor,
        deviceAttributeProcessor,
        appAttributeProcessor,
        installationIdAttributeProcessor,
        networkStateAttributeProcessor,
        powerStateAttributeProcessor,
    ),
    private val signalStore: SignalStore = SignalStoreImpl(
        logger = logger,
        database = database,
        fileStorage = fileStorage,
        idProvider = idProvider,
        configProvider = configProvider,
    ),
    override val periodicSignalStoreScheduler: PeriodicSignalStoreScheduler = PeriodicSignalStoreScheduler(
        logger = logger,
        defaultExecutor = executorServiceRegistry.defaultExecutor(),
        ioExecutor = executorServiceRegistry.ioExecutor(),
        signalStore = signalStore,
        configProvider = configProvider,
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
    private val exporter: Exporter = ExporterImpl(
        logger = logger,
        database = database,
        networkClient = networkClient,
        fileStorage = fileStorage,
        batchCreator = batchCreator,
    ),
    private val exceptionExporter: ExceptionExporter = ExceptionExporterImpl(
        logger = logger,
        exportExecutor = executorServiceRegistry.eventExportExecutor(),
        exporter = exporter,
    ),
    override val signalProcessor: SignalProcessor = SignalProcessorImpl(
        logger = logger,
        ioExecutor = executorServiceRegistry.ioExecutor(),
        signalStore = signalStore,
        idProvider = idProvider,
        sessionManager = sessionManager,
        attributeProcessors = attributeProcessors,
        exceptionExporter = exceptionExporter,
        screenshotCollector = screenshotCollector,
        configProvider = configProvider,
    ),
    override val userTriggeredEventCollector: UserTriggeredEventCollector = UserTriggeredEventCollectorImpl(
        logger = logger,
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        processInfoProvider = processInfoProvider,
        configProvider = configProvider,
    ),
    override val periodicExporter: PeriodicExporter = NoopPeriodicExporter(),
    override val unhandledExceptionCollector: UnhandledExceptionCollector = UnhandledExceptionCollector(
        logger = logger,
        timeProvider = timeProvider,
        signalProcessor = signalProcessor,
        processInfo = processInfoProvider,
    ),
    private val nativeBridgeImpl: NativeBridgeImpl = NativeBridgeImpl(logger),
    override val anrCollector: AnrCollector = AnrCollector(
        logger = logger,
        processInfo = processInfoProvider,
        signalProcessor = signalProcessor,
        nativeBridge = nativeBridgeImpl,
    ),
    private val appExitProvider: AppExitProvider = AppExitProviderImpl(
        logger = logger,
        systemServiceProvider = systemServiceProvider,
    ),
    override val appExitCollector: AppExitCollector = AppExitCollector(
        appExitProvider = appExitProvider,
        ioExecutor = executorServiceRegistry.ioExecutor(),
        signalProcessor = signalProcessor,
        sessionManager = sessionManager,
        database = database,
        logger = logger,
    ),
    override val cpuUsageCollector: CpuUsageCollector = CpuUsageCollector(
        logger = logger,
        timeProvider = timeProvider,
        signalProcessor = signalProcessor,
        processInfo = processInfoProvider,
        procProvider = procProvider,
        osSysConfProvider = osSysConfProvider,
        defaultExecutor = executorServiceRegistry.defaultExecutor(),
    ),
    override val memoryUsageCollector: MemoryUsageCollector = MemoryUsageCollector(
        logger = logger,
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        defaultExecutor = executorServiceRegistry.defaultExecutor(),
        memoryReader = memoryReader,
        processInfo = processInfoProvider,
    ),
    override val componentCallbacksCollector: ComponentCallbacksCollector = ComponentCallbacksCollector(
        application = application,
        timeProvider = timeProvider,
        signalProcessor = signalProcessor,
    ),
    override val appLifecycleManager: AppLifecycleManager = AppLifecycleManager(
        application = application,
    ),
    override val spanAttributeProcessors: List<AttributeProcessor> = emptyList(),
    private val spanProcessor: SpanProcessor = MsrSpanProcessor(
        signalProcessor = signalProcessor,
        attributeProcessors = spanAttributeProcessors,
        logger = logger,
        configProvider = configProvider,
    ),
    private val traceSampler: TraceSampler = TraceSamplerImpl(
        randomizer = randomizer,
        configProvider = configProvider,
    ),
    private val tracer: Tracer = MsrTracer(
        logger = logger,
        sessionManager = sessionManager,
        spanProcessor = spanProcessor,
        idProvider = idProvider,
        timeProvider = timeProvider,
        traceSampler = traceSampler,
    ),
    override val activityLifecycleCollector: DefaultActivityLifecycleCollector = DefaultActivityLifecycleCollector(
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        appLifecycleManager = appLifecycleManager,
        configProvider = configProvider,
        tracer = tracer,
    ),
    override val appLifecycleCollector: AppLifecycleCollector = AppLifecycleCollector(
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        appLifecycleManager = appLifecycleManager,
    ),
    override val gestureCollector: GestureCollector = GestureCollector(
        logger = logger,
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        defaultExecutor = executorServiceRegistry.defaultExecutor(),
        layoutSnapshotThrottler = LayoutSnapshotThrottler(timeProvider),
    ),
    private val launchTracker: LaunchTracker = LaunchTracker(
        logger,
        timeProvider,
        configProvider,
        tracer,
    ),
    override val appLaunchCollector: AppLaunchCollector = AppLaunchCollector(
        application = application,
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        launchTracker = launchTracker,
    ),
    override val networkChangesCollector: NetworkChangesCollector = NetworkChangesCollector(
        logger = logger,
        context = application,
        signalProcessor = signalProcessor,
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
    override val httpEventCollector: HttpEventCollector = OkHttpEventCollectorImpl(
        logger = logger,
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        configProvider = configProvider,
    ),
    override val spanCollector: SpanCollector = SpanCollector(tracer),
    override val bugReportCollector: BugReportCollector = BugReportCollectorImpl(
        logger = logger,
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        ioExecutor = executorServiceRegistry.ioExecutor(),
        fileStorage = fileStorage,
        idProvider = idProvider,
        configProvider = configProvider,
        sessionManager = sessionManager,
        resumedActivityProvider = resumedActivityProvider,
    ),
    override val customEventCollector: CustomEventCollector = CustomEventCollector(
        logger = logger,
        signalProcessor = signalProcessor,
        timeProvider = timeProvider,
        configProvider = configProvider,
    ),
    override val shakeBugReportCollector: ShakeBugReportCollector = ShakeBugReportCollector(
        shakeDetector = AccelerometerShakeDetector(
            sensorManager = systemServiceProvider.sensorManager,
            timeProvider = timeProvider,
            configProvider = configProvider,
        ),
    ),
    override val internalSignalCollector: InternalSignalCollector = InternalSignalCollector(
        logger = logger,
        signalProcessor = signalProcessor,
        processInfoProvider = processInfoProvider,
        sessionManager = sessionManager,
        spanAttributeProcessors = spanAttributeProcessors,
    ),
) : MeasureInitializer
