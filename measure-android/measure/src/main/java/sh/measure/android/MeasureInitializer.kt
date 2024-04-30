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
import sh.measure.android.attributes.UserAttributeProcessor
import sh.measure.android.events.EventProcessor
import sh.measure.android.events.EventProcessorImpl
import sh.measure.android.exceptions.UnhandledExceptionCollector
import sh.measure.android.executors.ExecutorServiceRegistry
import sh.measure.android.executors.ExecutorServiceRegistryImpl
import sh.measure.android.exporter.BatchCreator
import sh.measure.android.exporter.BatchCreatorImpl
import sh.measure.android.exporter.EventExporter
import sh.measure.android.exporter.EventExporterImpl
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
import sh.measure.android.okhttp.OkHttpEventCollector
import sh.measure.android.okhttp.OkHttpEventCollectorImpl
import sh.measure.android.performance.ComponentCallbacksCollector
import sh.measure.android.performance.CpuUsageCollector
import sh.measure.android.performance.DefaultMemoryReader
import sh.measure.android.performance.MemoryReader
import sh.measure.android.performance.MemoryUsageCollector
import sh.measure.android.storage.Database
import sh.measure.android.storage.DatabaseImpl
import sh.measure.android.storage.EventStore
import sh.measure.android.storage.EventStoreImpl
import sh.measure.android.storage.FileStorage
import sh.measure.android.storage.FileStorageImpl
import sh.measure.android.storage.PrefsStorage
import sh.measure.android.storage.PrefsStorageImpl
import sh.measure.android.utils.AndroidTimeProvider
import sh.measure.android.utils.DebugProvider
import sh.measure.android.utils.DefaultDebugProvider
import sh.measure.android.utils.DefaultRuntimeProvider
import sh.measure.android.utils.IdProvider
import sh.measure.android.utils.LocaleProvider
import sh.measure.android.utils.LocaleProviderImpl
import sh.measure.android.utils.ManifestReader
import sh.measure.android.utils.ManifestReaderImpl
import sh.measure.android.utils.OsSysConfProvider
import sh.measure.android.utils.OsSysConfProviderImpl
import sh.measure.android.utils.PidProvider
import sh.measure.android.utils.PidProviderImpl
import sh.measure.android.utils.ProcProvider
import sh.measure.android.utils.ProcProviderImpl
import sh.measure.android.utils.RuntimeProvider
import sh.measure.android.utils.SystemServiceProvider
import sh.measure.android.utils.SystemServiceProviderImpl
import sh.measure.android.utils.TimeProvider
import sh.measure.android.utils.UUIDProvider

internal class MeasureInitializerImpl(
    override val application: Application,
    override val logger: Logger = AndroidLogger(),
    override val timeProvider: TimeProvider = AndroidTimeProvider(),
    private val executorServiceRegistry: ExecutorServiceRegistry = ExecutorServiceRegistryImpl(),
    private val fileStorage: FileStorage = FileStorageImpl(
        rootDir = application.filesDir.path,
        logger = logger,
    ),
    val database: Database = DatabaseImpl(context = application, logger = logger),
    override val manifestReader: ManifestReaderImpl = ManifestReaderImpl(application, logger),
    override val networkClient: NetworkClient = NetworkClientImpl(
        logger = logger,
        fileStorage = fileStorage,
    ),
    val idProvider: IdProvider = UUIDProvider(),
    private val pidProvider: PidProvider = PidProviderImpl(),
    private val sessionManager: SessionManager = SessionManagerImpl(
        timeProvider = timeProvider,
        database = database,
        idProvider = idProvider,
        pidProvider = pidProvider,
        executorService = executorServiceRegistry.backgroundExecutor(),
    ),
    private val procProvider: ProcProvider = ProcProviderImpl(),
    private val debugProvider: DebugProvider = DefaultDebugProvider(),
    private val runtimeProvider: RuntimeProvider = DefaultRuntimeProvider(),
    private val memoryReader: MemoryReader = DefaultMemoryReader(
        logger = logger,
        pidProvider = pidProvider,
        procProvider = procProvider,
        debugProvider = debugProvider,
        runtimeProvider = runtimeProvider,
    ),
    private val localeProvider: LocaleProvider = LocaleProviderImpl(),
    private val prefsStorage: PrefsStorage = PrefsStorageImpl(context = application),
    private val systemServiceProvider: SystemServiceProvider = SystemServiceProviderImpl(application),
    private val initialNetworkStateProvider: InitialNetworkStateProvider = InitialNetworkStateProviderImpl(
        context = application,
        logger = logger,
        systemServiceProvider = systemServiceProvider,
    ),
    private val networkStateProvider: NetworkStateProvider = NetworkStateProviderImpl(
        initialNetworkStateProvider = initialNetworkStateProvider,
    ),
    override val userAttributeProcessor: UserAttributeProcessor = UserAttributeProcessor(),
    private val deviceAttributeProcessor: DeviceAttributeProcessor = DeviceAttributeProcessor(
        logger,
        context = application,
        localeProvider = localeProvider,
    ),
    private val appAttributeProcessor: AppAttributeProcessor = AppAttributeProcessor(
        context = application,
    ),
    private val installationIdAttributeProcessor: InstallationIdAttributeProcessor = InstallationIdAttributeProcessor(
        prefsStorage = prefsStorage,
        idProvider = idProvider,
    ),
    private val networkStateAttributeProcessor: NetworkStateAttributeProcessor = NetworkStateAttributeProcessor(
        networkStateProvider = networkStateProvider,
    ),
    private val attributeProcessors: List<AttributeProcessor> = listOf(
        userAttributeProcessor,
        deviceAttributeProcessor,
        appAttributeProcessor,
        installationIdAttributeProcessor,
        networkStateAttributeProcessor,
    ),
    private val eventExporter: EventExporter = EventExporterImpl(
        logger = logger,
        timeProvider = timeProvider,
        database = database,
        networkClient = networkClient,
        idProvider = idProvider,
        executorService = executorServiceRegistry.eventExportExecutor(),
        fileStorage = fileStorage,
    ),
    private val eventStore: EventStore = EventStoreImpl(
        logger = logger,
        database = database,
        fileStorage = fileStorage,
        idProvider = idProvider,
    ),
    override val eventProcessor: EventProcessor = EventProcessorImpl(
        logger = logger,
        executorService = executorServiceRegistry.eventProcessorExecutor(),
        idProvider = idProvider,
        attributeProcessors = attributeProcessors,
        eventExporter = eventExporter,
        eventStore = eventStore,
        sessionManager = sessionManager,
    ),
    val config: Config = DefaultConfig(),
    private val periodicHeartbeat: Heartbeat = HeartbeatImpl(
        logger,
        executorServiceRegistry.exportHeartbeatExecutor(),
    ),
    private val batchCreator: BatchCreator = BatchCreatorImpl(
        logger = logger,
        timeProvider = timeProvider,
        database = database,
        config = config,
        idProvider = idProvider,
    ),
    override val periodicEventExporter: PeriodicEventExporter = PeriodicEventExporterImpl(
        logger = logger,
        timeProvider = timeProvider,
        database = database,
        config = config,
        executorService = executorServiceRegistry.eventExportExecutor(),
        heartbeat = periodicHeartbeat,
        batchCreator = batchCreator,
        networkClient = networkClient,
        fileStorage = fileStorage,
    ),
    private val osSysConfProvider: OsSysConfProvider = OsSysConfProviderImpl(),
    override val okHttpEventCollector: OkHttpEventCollector = OkHttpEventCollectorImpl(
        logger = logger,
        timeProvider = timeProvider,
        eventProcessor = eventProcessor,
        config = config,
    ),
    override val unhandledExceptionCollector: UnhandledExceptionCollector = UnhandledExceptionCollector(
        logger = logger,
        timeProvider = timeProvider,
        eventProcessor = eventProcessor,
    ),
    override val anrCollector: AnrCollector = AnrCollector(
        logger = logger,
        systemServiceProvider = systemServiceProvider,
        timeProvider = timeProvider,
        eventProcessor = eventProcessor,
    ),
    private val appExitProvider: AppExitProvider = AppExitProviderImpl(
        logger = logger,
        systemServiceProvider = systemServiceProvider,
    ),
    override val appExitCollector: AppExitCollector = AppExitCollector(
        timeProvider = timeProvider,
        appExitProvider = appExitProvider,
        measureExecutorService = executorServiceRegistry.backgroundExecutor(),
        eventProcessor = eventProcessor,
        sessionManager = sessionManager,
    ),
    override val cpuUsageCollector: CpuUsageCollector = CpuUsageCollector(
        logger = logger,
        timeProvider = timeProvider,
        eventProcessor = eventProcessor,
        pidProvider = pidProvider,
        procProvider = procProvider,
        osSysConfProvider = osSysConfProvider,
        executorService = executorServiceRegistry.cpuAndMemoryCollectionExecutor(),
    ),
    override val memoryUsageCollector: MemoryUsageCollector = MemoryUsageCollector(
        eventProcessor = eventProcessor,
        timeProvider = timeProvider,
        executorService = executorServiceRegistry.cpuAndMemoryCollectionExecutor(),
        memoryReader = memoryReader,
    ),
    override val componentCallbacksCollector: ComponentCallbacksCollector = ComponentCallbacksCollector(
        application = application,
        timeProvider = timeProvider,
        eventProcessor = eventProcessor,
        memoryReader = memoryReader,
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
) : MeasureInitializer

internal interface MeasureInitializer {
    val application: Application
    val logger: Logger
    val timeProvider: TimeProvider
    val networkClient: NetworkClient
    val manifestReader: ManifestReader
    val eventProcessor: EventProcessor
    val okHttpEventCollector: OkHttpEventCollector
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
}
