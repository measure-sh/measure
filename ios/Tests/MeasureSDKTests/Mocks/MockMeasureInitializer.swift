//
//  MockMeasureInitializer.swift
//  TestApp
//
//  Created by Adwin Ross on 09/10/24.
//

import Foundation
@testable import Measure

final class MockMeasureInitializer: MeasureInitializer {
    // swiftlint:disable:this type_body_length
    let configLoader: ConfigLoader
    let signalSampler: SignalSampler
    let configProvider: ConfigProvider
    let client: Client
    let logger: Logger
    let sessionManager: SessionManager
    let idProvider: IdProvider
    let timeProvider: TimeProvider
    let userDefaultStorage: UserDefaultStorage
    let appAttributeProcessor: AppAttributeProcessor
    let deviceAttributeProcessor: DeviceAttributeProcessor
    let installationIdAttributeProcessor: InstallationIdAttributeProcessor
    let networkStateAttributeProcessor: NetworkStateAttributeProcessor
    let userAttributeProcessor: UserAttributeProcessor
    let attributeProcessors: [AttributeProcessor]
    let signalProcessor: SignalProcessor
    let crashReportManager: CrashReportManager
    var crashDataPersistence: CrashDataPersistence
    let systemFileManager: SystemFileManager
    let systemCrashReporter: SystemCrashReporter
    let sessionStore: SessionStore
    let coreDataManager: CoreDataManager
    let eventStore: EventStore
    let spanStore: SpanStore
    let signalStore: SignalStore
    let gestureCollector: GestureCollector
    let gestureTargetFinder: GestureTargetFinder
    let networkClient: NetworkClient
    let httpClient: HttpClient
    let exporter: Exporter
    let batchStore: BatchStore
    let lifecycleCollector: LifecycleCollector
    let cpuUsageCollector: CpuUsageCollector
    let memoryUsageCollector: MemoryUsageCollector
    let cpuUsageCalculator: CpuUsageCalculator
    let memoryUsageCalculator: MemoryUsageCalculator
    let sysCtl: SysCtl
    let launchCallback: LaunchCallbacks
    let launchTracker: LaunchTracker
    let appLaunchCollector: AppLaunchCollector
    var httpEventCollector: HttpEventCollector
    let networkChangeCollector: NetworkChangeCollector
    let customEventCollector: CustomEventCollector
    let userTriggeredEventCollector: UserTriggeredEventCollector
    let dataCleanupService: DataCleanupService
    let attachmentProcessor: AttachmentProcessor
    let layoutSnapshotGenerator: LayoutSnapshotGenerator
    let userPermissionManager: UserPermissionManager
    let svgGenerator: SvgGenerator
    let httpEventValidator: HttpEventValidator
    let randomizer: Randomizer
    let spanProcessor: SpanProcessor
    let spanCollector: SpanCollector
    let tracer: Tracer
    var internalSignalCollector: InternalSignalCollector
    let bugReportManager: BugReportManager
    let bugReportCollector: BugReportCollector
    let shakeBugReportCollector: ShakeBugReportCollector
    let shakeDetector: ShakeDetector
    let screenshotGenerator: ScreenshotGenerator
    let exceptionGenerator: ExceptionGenerator
    let measureDispatchQueue: MeasureDispatchQueue
    let attributeValueValidator: AttributeValueValidator
    let attachmentStore: AttachmentStore

    init(client: Client? = nil, // swiftlint:disable:this function_body_length
         configLoader: ConfigLoader? = nil,
         configProvider: ConfigProvider? = nil,
         logger: Logger? = nil,
         idProvider: IdProvider? = nil,
         timeProvider: TimeProvider? = nil,
         userDefaultStorage: UserDefaultStorage? = nil,
         coreDataManager: CoreDataManager? = nil,
         sessionStore: SessionStore? = nil,
         eventStore: EventStore? = nil,
         spanStore: SpanStore? = nil,
         signalStore: SignalStore? = nil,
         sessionManager: SessionManager? = nil,
         signalProcessor: SignalProcessor? = nil,
         systemFileManager: SystemFileManager? = nil,
         crashDataPersistence: CrashDataPersistence? = nil,
         systemCrashReporter: SystemCrashReporter? = nil,
         crashReportManager: CrashReportManager? = nil,
         attachmentProcessor: AttachmentProcessor? = nil,
         gestureTargetFinder: GestureTargetFinder? = nil,
         gestureCollector: GestureCollector? = nil,
         httpClient: HttpClient? = nil,
         networkClient: NetworkClient? = nil,
         batchStore: BatchStore? = nil,
         exporter: Exporter? = nil,
         lifecycleCollector: LifecycleCollector? = nil,
         cpuUsageCalculator: CpuUsageCalculator? = nil,
         memoryUsageCalculator: MemoryUsageCalculator? = nil,
         sysCtl: SysCtl? = nil,
         cpuUsageCollector: CpuUsageCollector? = nil,
         memoryUsageCollector: MemoryUsageCollector? = nil,
         launchCallback: LaunchCallbacks? = nil,
         launchTracker: LaunchTracker? = nil,
         appLaunchCollector: AppLaunchCollector? = nil,
         networkChangeCollector: NetworkChangeCollector? = nil,
         customEventCollector: CustomEventCollector? = nil,
         userTriggeredEventCollector: UserTriggeredEventCollector? = nil,
         dataCleanupService: DataCleanupService? = nil,
         userPermissionManager: UserPermissionManager? = nil,
         svgGenerator: SvgGenerator? = nil,
         layoutSnapshotGenerator: LayoutSnapshotGenerator? = nil,
         httpEventValidator: HttpEventValidator? = nil,
         httpEventCollector: HttpEventCollector? = nil,
         appAttributeProcessor: AppAttributeProcessor? = nil,
         deviceAttributeProcessor: DeviceAttributeProcessor? = nil,
         installationIdAttributeProcessor: InstallationIdAttributeProcessor? = nil,
         networkStateAttributeProcessor: NetworkStateAttributeProcessor? = nil,
         userAttributeProcessor: UserAttributeProcessor? = nil,
         randomizer: Randomizer? = nil,
         spanProcessor: SpanProcessor? = nil,
         spanCollector: SpanCollector? = nil,
         tracer: Tracer? = nil,
         internalSignalCollector: InternalSignalCollector? = nil,
         exceptionGenerator: ExceptionGenerator? = nil,
         measureDispatchQueue: MeasureDispatchQueue? = nil,
         attributeValueValidator: AttributeValueValidator? = nil,
         attachmentStore: AttachmentStore? = nil,
         signalSampler: SignalSampler? = nil,
         screenshotGenerator: ScreenshotGenerator? = nil,
         bugReportManager: BugReportManager? = nil,
         bugReportCollector: BugReportCollector? = nil,
         shakeDetector: ShakeDetector? = nil,
         shakeBugReportCollector: ShakeBugReportCollector? = nil) {
        self.client = client ?? ClientInfo(apiKey: "test", apiUrl: "https://test.com")
        self.configProvider = configProvider ?? BaseConfigProvider(defaultConfig: Config())
        self.logger = logger ?? MockLogger()
        self.userDefaultStorage = userDefaultStorage ?? BaseUserDefaultStorage()
        self.systemFileManager = systemFileManager ?? BaseSystemFileManager(logger: self.logger)
        self.httpClient = httpClient ?? BaseHttpClient(logger: self.logger, configProvider: self.configProvider)
        self.networkClient = networkClient ?? BaseNetworkClient(client: self.client,
                                               httpClient: self.httpClient,
                                               eventSerializer: EventSerializer(),
                                               systemFileManager: self.systemFileManager)
        self.timeProvider = timeProvider ?? BaseTimeProvider()
        self.configLoader = configLoader ?? BaseConfigLoader(userDefaultStorage: self.userDefaultStorage,
                                             fileManager: self.systemFileManager,
                                             networkClient: self.networkClient,
                                            timeProvider: self.timeProvider,
                                             logger: self.logger)
        self.idProvider = idProvider ?? UUIDProvider()
        self.coreDataManager = coreDataManager ?? BaseCoreDataManager(logger: self.logger)
        self.sessionStore = sessionStore ?? MockSessionStore()
        self.eventStore = eventStore ?? MockEventStore()
        self.spanStore = spanStore ?? MockSpanStore()
        self.batchStore = batchStore ?? MockBatchStore()
        self.attachmentStore = attachmentStore ?? MockAttachmentStore()
        self.randomizer = randomizer ?? BaseRandomizer()
        self.signalSampler = signalSampler ?? BaseSignalSampler(configProvider: self.configProvider,
                                                               randomizer: self.randomizer)
        self.signalStore = signalStore ?? BaseSignalStore(eventStore: self.eventStore,
                                                          spanStore: self.spanStore,
                                                          sessionStore: self.sessionStore,
                                                          logger: self.logger,
                                                          config: self.configProvider)
        self.sessionManager = sessionManager ?? BaseSessionManager(idProvider: self.idProvider,
                                                                   logger: self.logger,
                                                                   timeProvider: self.timeProvider,
                                                                   configProvider: self.configProvider,
                                                                   sessionStore: self.sessionStore,
                                                                   eventStore: self.eventStore,
                                                                   userDefaultStorage: self.userDefaultStorage,
                                                                   versionCode: FrameworkInfo.version,
                                                                   signalSampler: self.signalSampler)
        self.exporter = exporter ?? MockExporter()
        self.measureDispatchQueue = measureDispatchQueue ?? BaseMeasureDispatchQueue()
        self.appAttributeProcessor = appAttributeProcessor ?? AppAttributeProcessor()
        self.deviceAttributeProcessor = deviceAttributeProcessor ?? DeviceAttributeProcessor()
        self.installationIdAttributeProcessor = installationIdAttributeProcessor ?? InstallationIdAttributeProcessor(userDefaultStorage: self.userDefaultStorage,
                                                                                 idProvider: self.idProvider)
        self.networkStateAttributeProcessor = networkStateAttributeProcessor ?? NetworkStateAttributeProcessor(measureDispatchQueue: self.measureDispatchQueue)
        self.userAttributeProcessor = userAttributeProcessor ?? UserAttributeProcessor(userDefaultStorage: self.userDefaultStorage,
                                                             measureDispatchQueue: self.measureDispatchQueue)
        self.attributeProcessors = [
            self.appAttributeProcessor,
            self.deviceAttributeProcessor,
            self.installationIdAttributeProcessor,
            self.networkStateAttributeProcessor,
            self.userAttributeProcessor
        ]
        self.crashDataPersistence = crashDataPersistence ?? BaseCrashDataPersistence(logger: logger ?? MockLogger(),
                                                             systemFileManager: self.systemFileManager)
        CrashDataWriter.shared.setCrashDataPersistence(self.crashDataPersistence)
        self.attachmentProcessor = attachmentProcessor ?? BaseAttachmentProcessor(logger: self.logger,
                                                           fileManager: self.systemFileManager,
                                                           idProvider: self.idProvider)
        self.userPermissionManager = userPermissionManager ?? BaseUserPermissionManager()
        self.svgGenerator = svgGenerator ?? BaseSvgGenerator()
        self.layoutSnapshotGenerator = layoutSnapshotGenerator ?? BaseLayoutSnapshotGenerator(logger: self.logger,
                                                                   configProvider: self.configProvider,
                                                                   timeProvider: self.timeProvider,
                                                                   attachmentProcessor: self.attachmentProcessor,
                                                                   svgGenerator: self.svgGenerator)

        self.attributeValueValidator = attributeValueValidator ?? BaseAttributeValueValidator(configProvider: self.configProvider,
                                                                   logger: self.logger)
        self.signalProcessor = signalProcessor ?? BaseSignalProcessor(logger: self.logger,
                                                   idProvider: self.idProvider,
                                                   sessionManager: self.sessionManager,
                                                   attributeProcessors: self.attributeProcessors,
                                                   configProvider: self.configProvider,
                                                   timeProvider: self.timeProvider,
                                                   crashDataPersistence: self.crashDataPersistence,
                                                   signalStore: self.signalStore,
                                                   measureDispatchQueue: self.measureDispatchQueue,
                                                   signalSampler: self.signalSampler,
                                                   exporter: self.exporter)
        self.systemCrashReporter = systemCrashReporter ?? BaseSystemCrashReporter(logger: self.logger)

        self.crashReportManager = crashReportManager ?? CrashReportingManager(logger: self.logger,
                                                        signalProcessor: self.signalProcessor,
                                                        crashDataPersistence: self.crashDataPersistence,
                                                        crashReporter: self.systemCrashReporter,
                                                        systemFileManager: self.systemFileManager,
                                                        idProvider: self.idProvider,
                                                        configProvider: self.configProvider)
        self.spanProcessor = spanProcessor ?? BaseSpanProcessor(logger: self.logger,
                                               signalProcessor: self.signalProcessor,
                                               attributeProcessors: attributeProcessors,
                                               configProvider: self.configProvider,
                                               sampler: self.signalSampler,
                                               attributeValueValidator: self.attributeValueValidator)
        self.tracer = tracer ?? MsrTracer(logger: self.logger,
                                idProvider: self.idProvider,
                                timeProvider: self.timeProvider,
                                spanProcessor: self.spanProcessor,
                                sessionManager: self.sessionManager,
                                signalSampler: self.signalSampler)
        self.spanCollector = spanCollector ?? BaseSpanCollector(tracer: self.tracer)
        self.gestureTargetFinder = gestureTargetFinder ?? BaseGestureTargetFinder()
        self.gestureCollector = gestureCollector ?? BaseGestureCollector(logger: self.logger,
                                                                         signalProcessor: self.signalProcessor,
                                                                         timeProvider: self.timeProvider,
                                                                         configProvider: self.configProvider,
                                                                         gestureTargetFinder: self.gestureTargetFinder,
                                                                         layoutSnapshotGenerator: self.layoutSnapshotGenerator,
                                                                         systemFileManager: self.systemFileManager)
        self.lifecycleCollector = lifecycleCollector ?? BaseLifecycleCollector(signalProcessor: self.signalProcessor,
                                                         timeProvider: self.timeProvider,
                                                         tracer: self.tracer,
                                                         configProvider: self.configProvider,
                                                         sessionManager: self.sessionManager,
                                                         logger: self.logger,
                                                         signalSampler: self.signalSampler)
        self.cpuUsageCalculator = cpuUsageCalculator ?? BaseCpuUsageCalculator()
        self.memoryUsageCalculator = memoryUsageCalculator ?? BaseMemoryUsageCalculator()
        self.sysCtl = sysCtl ?? BaseSysCtl()
        self.cpuUsageCollector = cpuUsageCollector ?? BaseCpuUsageCollector(logger: self.logger,
                                                       configProvider: self.configProvider,
                                                       signalProcessor: self.signalProcessor,
                                                       timeProvider: self.timeProvider,
                                                       cpuUsageCalculator: self.cpuUsageCalculator,
                                                       sysCtl: self.sysCtl)
        self.memoryUsageCollector = memoryUsageCollector ?? BaseMemoryUsageCollector(logger: self.logger,
                                                             configProvider: self.configProvider,
                                                             signalProcessor: self.signalProcessor,
                                                             timeProvider: self.timeProvider,
                                                             memoryUsageCalculator: self.memoryUsageCalculator,
                                                             sysCtl: self.sysCtl)

        self.launchCallback = launchCallback ?? LaunchCallbacks()
        self.launchTracker = launchTracker ?? BaseLaunchTracker(launchCallbacks: self.launchCallback,
                                               timeProvider: self.timeProvider,
                                               sysCtl: self.sysCtl,
                                               logger: self.logger,
                                               userDefaultStorage: self.userDefaultStorage,
                                               currentAppVersion: "test")

        self.appLaunchCollector = appLaunchCollector ?? BaseAppLaunchCollector(logger: self.logger,
                                                         timeProvider: self.timeProvider,
                                                         signalProcessor: self.signalProcessor,
                                                         sysCtl: self.sysCtl,
                                                         userDefaultStorage: self.userDefaultStorage,
                                                         sampler: self.signalSampler,
                                                         launchTracker: self.launchTracker,
                                                         launchCallback: self.launchCallback)

        self.networkChangeCollector = networkChangeCollector ?? BaseNetworkChangeCollector(logger: self.logger,
                                                                 signalProcessor: self.signalProcessor,
                                                                 timeProvider: self.timeProvider)
        self.customEventCollector = customEventCollector ?? BaseCustomEventCollector(logger: self.logger,
                                                             signalProcessor: self.signalProcessor,
                                                             timeProvider: self.timeProvider,
                                                             configProvider: self.configProvider,
                                                             attributeValueValidator: self.attributeValueValidator)
        self.exceptionGenerator = exceptionGenerator ?? BaseExceptionGenerator(crashReporter: self.systemCrashReporter,
                                                         logger: self.logger)
        self.userTriggeredEventCollector = userTriggeredEventCollector ?? BaseUserTriggeredEventCollector(signalProcessor: self.signalProcessor,
                                                                           timeProvider: self.timeProvider,
                                                                           logger: self.logger,
                                                                           exceptionGenerator: self.exceptionGenerator,
                                                                           attributeValueValidator: self.attributeValueValidator,
                                                                           configProvider: self.configProvider,
                                                                           sessionManager: self.sessionManager,
                                                                           signalSampler: self.signalSampler)
        self.dataCleanupService = dataCleanupService ?? BaseDataCleanupService(eventStore: self.eventStore,
                                                         spanStore: self.spanStore,
                                                         sessionStore: self.sessionStore,
                                                         logger: self.logger,
                                                         sessionManager: self.sessionManager,
                                                         configProvider: self.configProvider,
                                                         attachmentStore: self.attachmentStore)
        self.httpEventValidator = httpEventValidator ?? BaseHttpEventValidator()
        self.httpEventCollector = httpEventCollector ?? BaseHttpEventCollector(logger: self.logger,
                                                         signalProcessor: self.signalProcessor,
                                                         timeProvider: self.timeProvider,
                                                         urlSessionTaskSwizzler: URLSessionTaskSwizzler(),
                                                         httpInterceptorCallbacks: HttpInterceptorCallbacks(),
                                                         client: self.client,
                                                         configProvider: self.configProvider,
                                                         httpEventValidator: self.httpEventValidator)
        self.internalSignalCollector = internalSignalCollector ?? BaseInternalSignalCollector(logger: self.logger,
                                                                   timeProvider: self.timeProvider,
                                                                   signalProcessor: self.signalProcessor,
                                                                   sessionManager: self.sessionManager,
                                                                   attributeProcessors: self.attributeProcessors,
                                                                   signalSampler: self.signalSampler)
        self.screenshotGenerator = screenshotGenerator ?? BaseScreenshotGenerator(configProvider: self.configProvider,
                                                           logger: self.logger,
                                                           attachmentProcessor: self.attachmentProcessor,
                                                           userPermissionManager: self.userPermissionManager)
        self.bugReportManager = bugReportManager ?? BaseBugReportManager(screenshotGenerator: self.screenshotGenerator,
                                                     configProvider: self.configProvider,
                                                     idProvider: self.idProvider)

        self.bugReportCollector = bugReportCollector ?? BaseBugReportCollector(bugReportManager: self.bugReportManager,
                                                         signalProcessor: self.signalProcessor,
                                                         timeProvider: self.timeProvider,
                                                         sessionManager: self.sessionManager,
                                                         idProvider: self.idProvider,
                                                         logger: self.logger)

        self.shakeDetector = shakeDetector ?? AccelerometerShakeDetector(configProvider: self.configProvider)
        self.shakeBugReportCollector = shakeBugReportCollector ?? ShakeBugReportCollector(shakeDetector: self.shakeDetector)
    }
}
