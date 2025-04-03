//
//  MockMeasureInitializer.swift
//  TestApp
//
//  Created by Adwin Ross on 09/10/24.
//

import Foundation
@testable import Measure

final class MockMeasureInitializer: MeasureInitializer {
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
    let eventProcessor: EventProcessor
    let crashReportManager: CrashReportManager
    var crashDataPersistence: CrashDataPersistence
    let systemFileManager: SystemFileManager
    let systemCrashReporter: SystemCrashReporter
    let sessionStore: SessionStore
    let coreDataManager: CoreDataManager
    let eventStore: EventStore
    let gestureCollector: GestureCollector
    let gestureTargetFinder: GestureTargetFinder
    let networkClient: NetworkClient
    let httpClient: HttpClient
    let heartbeat: Heartbeat
    let periodicEventExporter: PeriodicEventExporter
    let eventExporter: EventExporter
    let batchStore: BatchStore
    let batchCreator: BatchCreator
    let lifecycleCollector: LifecycleCollector
    let cpuUsageCollector: CpuUsageCollector
    let memoryUsageCollector: MemoryUsageCollector
    let cpuUsageCalculator: CpuUsageCalculator
    let memoryUsageCalculator: MemoryUsageCalculator
    let sysCtl: SysCtl
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
    let appVersionInfo: AppVersionInfo
    let httpEventValidator: HttpEventValidator

    init(client: Client? = nil, // swiftlint:disable:this function_body_length
         configProvider: ConfigProvider? = nil,
         logger: Logger? = nil,
         idProvider: IdProvider? = nil,
         timeProvider: TimeProvider? = nil,
         appVersionInfo: AppVersionInfo? = nil,
         userDefaultStorage: UserDefaultStorage? = nil,
         coreDataManager: CoreDataManager? = nil,
         sessionStore: SessionStore? = nil,
         eventStore: EventStore? = nil,
         sessionManager: SessionManager? = nil,
         eventProcessor: EventProcessor? = nil,
         systemFileManager: SystemFileManager? = nil,
         crashDataPersistence: CrashDataPersistence? = nil,
         systemCrashReporter: SystemCrashReporter? = nil,
         crashReportManager: CrashReportManager? = nil,
         attachmentProcessor: AttachmentProcessor? = nil,
         gestureTargetFinder: GestureTargetFinder? = nil,
         gestureCollector: GestureCollector? = nil,
         httpClient: HttpClient? = nil,
         networkClient: NetworkClient? = nil,
         heartbeat: Heartbeat? = nil,
         batchStore: BatchStore? = nil,
         batchCreator: BatchCreator? = nil,
         eventExporter: EventExporter? = nil,
         periodicEventExporter: PeriodicEventExporter? = nil,
         lifecycleCollector: LifecycleCollector? = nil,
         cpuUsageCalculator: CpuUsageCalculator? = nil,
         memoryUsageCalculator: MemoryUsageCalculator? = nil,
         sysCtl: SysCtl? = nil,
         cpuUsageCollector: CpuUsageCollector? = nil,
         memoryUsageCollector: MemoryUsageCollector? = nil,
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
         userAttributeProcessor: UserAttributeProcessor? = nil) {
        self.client = client ?? ClientInfo(apiKey: "test", apiUrl: "https://test.com")
        self.configProvider = configProvider ?? BaseConfigProvider(defaultConfig: Config(),
                                                                   configLoader: BaseConfigLoader())
        self.timeProvider = timeProvider ?? BaseTimeProvider()
        self.appVersionInfo = appVersionInfo ?? BaseAppVersionInfo()
        self.logger = logger ?? MockLogger()
        self.idProvider = idProvider ?? UUIDProvider()
        self.coreDataManager = coreDataManager ?? BaseCoreDataManager(logger: self.logger)
        self.sessionStore = sessionStore ?? BaseSessionStore(coreDataManager: self.coreDataManager,
                                                             logger: self.logger)
        self.eventStore = eventStore ?? BaseEventStore(coreDataManager: self.coreDataManager,
                                                       logger: self.logger)
        self.userDefaultStorage = userDefaultStorage ?? BaseUserDefaultStorage()
        self.sessionManager = sessionManager ?? BaseSessionManager(idProvider: self.idProvider,
                                                                   logger: self.logger,
                                                                   timeProvider: self.timeProvider,
                                                                   configProvider: self.configProvider,
                                                                   sessionStore: self.sessionStore,
                                                                   eventStore: self.eventStore,
                                                                   userDefaultStorage: self.userDefaultStorage,
                                                                   versionCode: FrameworkInfo.version,
                                                                   appVersionInfo: self.appVersionInfo)
        self.appAttributeProcessor = appAttributeProcessor ?? AppAttributeProcessor()
        self.deviceAttributeProcessor = deviceAttributeProcessor ?? DeviceAttributeProcessor()
        self.installationIdAttributeProcessor = installationIdAttributeProcessor ?? InstallationIdAttributeProcessor(userDefaultStorage: self.userDefaultStorage,
                                                                                                                     idProvider: self.idProvider)
        self.networkStateAttributeProcessor = networkStateAttributeProcessor ?? NetworkStateAttributeProcessor()
        self.userAttributeProcessor = userAttributeProcessor ?? UserAttributeProcessor(userDefaultStorage: self.userDefaultStorage)
        self.attributeProcessors = [self.appAttributeProcessor,
                                    self.deviceAttributeProcessor,
                                    self.installationIdAttributeProcessor,
                                    self.networkStateAttributeProcessor,
                                    self.userAttributeProcessor]
        self.systemFileManager = systemFileManager ?? BaseSystemFileManager(logger: self.logger)
        self.crashDataPersistence = crashDataPersistence ?? BaseCrashDataPersistence(logger: self.logger,
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
        self.eventProcessor = eventProcessor ?? BaseEventProcessor(logger: self.logger,
                                                                   idProvider: self.idProvider,
                                                                   sessionManager: self.sessionManager,
                                                                   attributeProcessors: self.attributeProcessors,
                                                                   configProvider: self.configProvider,
                                                                   timeProvider: self.timeProvider,
                                                                   crashDataPersistence: self.crashDataPersistence,
                                                                   eventStore: self.eventStore)
        self.systemCrashReporter = systemCrashReporter ?? BaseSystemCrashReporter(logger: self.logger)
        self.crashReportManager = crashReportManager ?? CrashReportingManager(logger: self.logger,
                                                                              eventProcessor: self.eventProcessor,
                                                                              crashDataPersistence: self.crashDataPersistence,
                                                                              crashReporter: self.systemCrashReporter,
                                                                              systemFileManager: self.systemFileManager,
                                                                              idProvider: self.idProvider,
                                                                              configProvider: self.configProvider)
        self.gestureTargetFinder = gestureTargetFinder ?? BaseGestureTargetFinder()
        self.gestureCollector = gestureCollector ?? BaseGestureCollector(logger: self.logger,
                                                                         eventProcessor: self.eventProcessor,
                                                                         timeProvider: self.timeProvider,
                                                                         configProvider: self.configProvider,
                                                                         gestureTargetFinder: self.gestureTargetFinder,
                                                                         layoutSnapshotGenerator: self.layoutSnapshotGenerator,
                                                                         systemFileManager: self.systemFileManager)
        self.httpClient = httpClient ?? BaseHttpClient(logger: self.logger, configProvider: self.configProvider)
        self.networkClient = networkClient ?? BaseNetworkClient(client: self.client,
                                                                httpClient: self.httpClient,
                                                                eventSerializer: EventSerializer(),
                                                                systemFileManager: self.systemFileManager)
        self.heartbeat = heartbeat ?? BaseHeartbeat()
        self.batchStore = batchStore ?? BaseBatchStore(coreDataManager: self.coreDataManager,
                                                       logger: self.logger)
        self.batchCreator = batchCreator ?? BaseBatchCreator(logger: self.logger,
                                                             idProvider: self.idProvider,
                                                             configProvider: self.configProvider,
                                                             timeProvider: self.timeProvider,
                                                             eventStore: self.eventStore,
                                                             batchStore: self.batchStore)
        self.eventExporter = eventExporter ?? BaseEventExporter(logger: self.logger,
                                                                networkClient: self.networkClient,
                                                                batchCreator: self.batchCreator,
                                                                batchStore: self.batchStore,
                                                                eventStore: self.eventStore)
        self.periodicEventExporter = periodicEventExporter ?? BasePeriodicEventExporter(logger: self.logger,
                                                                                        configProvider: self.configProvider,
                                                                                        timeProvider: self.timeProvider,
                                                                                        heartbeat: self.heartbeat,
                                                                                        eventExporter: self.eventExporter,
                                                                                        dispatchQueue: MeasureQueue.periodicEventExporter)
        self.lifecycleCollector = lifecycleCollector ?? BaseLifecycleCollector(eventProcessor: self.eventProcessor,
                                                                               timeProvider: self.timeProvider,
                                                                               logger: self.logger)
        self.cpuUsageCalculator = cpuUsageCalculator ?? BaseCpuUsageCalculator()
        self.memoryUsageCalculator = memoryUsageCalculator ?? BaseMemoryUsageCalculator()
        self.sysCtl = sysCtl ?? BaseSysCtl()
        self.cpuUsageCollector = cpuUsageCollector ?? BaseCpuUsageCollector(logger: self.logger,
                                                                            configProvider: self.configProvider,
                                                                            eventProcessor: self.eventProcessor,
                                                                            timeProvider: self.timeProvider,
                                                                            cpuUsageCalculator: self.cpuUsageCalculator,
                                                                            sysCtl: self.sysCtl)
        self.memoryUsageCollector = memoryUsageCollector ?? BaseMemoryUsageCollector(logger: self.logger,
                                                                                     configProvider: self.configProvider,
                                                                                     eventProcessor: self.eventProcessor,
                                                                                     timeProvider: self.timeProvider,
                                                                                     memoryUsageCalculator: self.memoryUsageCalculator,
                                                                                     sysCtl: self.sysCtl)
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? AttributeConstants.unknown
        self.appLaunchCollector = appLaunchCollector ?? BaseAppLaunchCollector(logger: self.logger,
                                                                               timeProvider: self.timeProvider,
                                                                               eventProcessor: self.eventProcessor,
                                                                               sysCtl: self.sysCtl,
                                                                               userDefaultStorage: self.userDefaultStorage,
                                                                               currentAppVersion: appVersion)
        self.networkChangeCollector = networkChangeCollector ?? BaseNetworkChangeCollector(logger: self.logger,
                                                                                           eventProcessor: self.eventProcessor,
                                                                                           timeProvider: self.timeProvider)
        self.customEventCollector = customEventCollector ?? BaseCustomEventCollector(logger: self.logger,
                                                                                     eventProcessor: self.eventProcessor,
                                                                                     timeProvider: self.timeProvider,
                                                                                     configProvider: self.configProvider)
        self.userTriggeredEventCollector = userTriggeredEventCollector ?? BaseUserTriggeredEventCollector(eventProcessor: self.eventProcessor,
                                                                                                          timeProvider: self.timeProvider,
                                                                                                          logger: self.logger)
        self.dataCleanupService = dataCleanupService ?? BaseDataCleanupService(eventStore: self.eventStore,
                                                                               sessionStore: self.sessionStore,
                                                                               logger: self.logger,
                                                                               sessionManager: self.sessionManager)
        self.httpEventValidator = httpEventValidator ?? BaseHttpEventValidator()
        self.httpEventCollector = httpEventCollector ?? BaseHttpEventCollector(logger: self.logger,
                                                                               eventProcessor: self.eventProcessor,
                                                                               timeProvider: self.timeProvider,
                                                                               urlSessionTaskSwizzler: URLSessionTaskSwizzler(),
                                                                               httpInterceptorCallbacks: HttpInterceptorCallbacks(),
                                                                               client: self.client,
                                                                               configProvider: self.configProvider,
                                                                               httpEventValidator: self.httpEventValidator)
    }
}
