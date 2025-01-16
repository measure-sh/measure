//
//  MockMeasureInitializer.swift
//  TestApp
//
//  Created by Adwin Ross on 09/10/24.
//

import Foundation
@testable import MeasureSDK

final class MockMeasureInitializer: MeasureInitializer {
    let lifecycleCollector: LifecycleCollector
    let networkClient: NetworkClient
    let httpClient: HttpClient
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
    let periodicEventExporter: PeriodicEventExporter
    let heartbeat: Heartbeat
    let eventExporter: EventExporter
    let batchStore: BatchStore
    let batchCreator: BatchCreator
    let cpuUsageCollector: CpuUsageCollector
    let memoryUsageCollector: MemoryUsageCollector
    let cpuUsageCalculator: CpuUsageCalculator
    let memoryUsageCalculator: MemoryUsageCalculator
    let sysCtl: SysCtl
    let appLaunchCollector: AppLaunchCollector
    let httpEventCollector: HttpEventCollector
    let customEventCollector: CustomEventCollector
    let networkChangeCollector: NetworkChangeCollector
    let userTriggeredEventCollector: UserTriggeredEventCollector
    let dataCleanupService: DataCleanupService

    init(config: MeasureConfig, // swiftlint:disable:this function_body_length
         client: Client) {
        let defaultConfig = Config(enableLogging: config.enableLogging,
                                   trackScreenshotOnCrash: config.trackScreenshotOnCrash,
                                   samplingRateForErrorFreeSessions: config.samplingRateForErrorFreeSessions)

        self.configProvider = BaseConfigProvider(defaultConfig: defaultConfig,
                                                 configLoader: BaseConfigLoader())
        self.timeProvider = BaseTimeProvider()
        self.logger = MockLogger()
        self.idProvider = UUIDProvider()
        self.coreDataManager = BaseCoreDataManager()
        self.sessionStore = BaseSessionStore(coreDataManager: coreDataManager,
                                             logger: logger)
        self.eventStore = BaseEventStore(coreDataManager: coreDataManager,
                                         logger: logger)
        self.userDefaultStorage = BaseUserDefaultStorage()
        self.sessionManager = BaseSessionManager(idProvider: idProvider,
                                                 logger: logger,
                                                 timeProvider: timeProvider,
                                                 configProvider: configProvider,
                                                 sessionStore: sessionStore,
                                                 eventStore: eventStore,
                                                 userDefaultStorage: userDefaultStorage,
                                                 versionCode: "1.0.0")
        self.appAttributeProcessor = AppAttributeProcessor()
        self.deviceAttributeProcessor = DeviceAttributeProcessor()
        self.installationIdAttributeProcessor = InstallationIdAttributeProcessor(userDefaultStorage: userDefaultStorage,
                                                                                 idProvider: idProvider)
        self.networkStateAttributeProcessor = NetworkStateAttributeProcessor()
        self.userAttributeProcessor = UserAttributeProcessor(userDefaultStorage: userDefaultStorage)
        self.attributeProcessors = [appAttributeProcessor,
                                    deviceAttributeProcessor,
                                    installationIdAttributeProcessor,
                                    networkStateAttributeProcessor,
                                    userAttributeProcessor]
        self.systemFileManager = BaseSystemFileManager(logger: logger)
        self.crashDataPersistence = BaseCrashDataPersistence(logger: logger,
                                                             systemFileManager: systemFileManager)
        CrashDataWriter.shared.setCrashDataPersistence(crashDataPersistence)
        self.eventProcessor = BaseEventProcessor(logger: logger,
                                                 idProvider: idProvider,
                                                 sessionManager: sessionManager,
                                                 attributeProcessors: attributeProcessors,
                                                 configProvider: configProvider,
                                                 timeProvider: timeProvider,
                                                 crashDataPersistence: crashDataPersistence,
                                                 eventStore: eventStore)
        self.systemCrashReporter = BaseSystemCrashReporter()
        self.crashReportManager = CrashReportingManager(logger: logger,
                                                        eventProcessor: eventProcessor,
                                                        crashDataPersistence: crashDataPersistence,
                                                        crashReporter: systemCrashReporter)
        self.gestureTargetFinder = BaseGestureTargetFinder()
        self.gestureCollector = BaseGestureCollector(logger: logger,
                                                     eventProcessor: eventProcessor,
                                                     timeProvider: timeProvider,
                                                     configProvider: configProvider,
                                                     gestureTargetFinder: gestureTargetFinder)
        self.httpClient = BaseHttpClient(logger: logger, configProvider: configProvider)
        self.networkClient = BaseNetworkClient(client: client,
                                               httpClient: httpClient,
                                               eventSerializer: EventSerializer())
        self.heartbeat = BaseHeartbeat()
        self.batchStore = BaseBatchStore(coreDataManager: coreDataManager,
                                         logger: logger)
        self.batchCreator = BaseBatchCreator(logger: logger,
                                             idProvider: idProvider,
                                             configProvider: configProvider,
                                             timeProvider: timeProvider,
                                             eventStore: eventStore,
                                             batchStore: batchStore)
        self.eventExporter = BaseEventExporter(logger: logger,
                                               networkClient: networkClient,
                                               batchCreator: batchCreator,
                                               batchStore: batchStore,
                                               eventStore: eventStore)
        self.periodicEventExporter = BasePeriodicEventExporter(logger: logger,
                                                               configProvider: configProvider,
                                                               timeProvider: timeProvider,
                                                               heartbeat: heartbeat,
                                                               eventExporter: eventExporter,
                                                               dispatchQueue: MeasureQueue.periodicEventExporter)
        self.lifecycleCollector = BaseLifecycleCollector(eventProcessor: eventProcessor,
                                                         timeProvider: timeProvider,
                                                         logger: logger)
        self.cpuUsageCalculator = BaseCpuUsageCalculator()
        self.memoryUsageCalculator = BaseMemoryUsageCalculator()
        self.sysCtl = BaseSysCtl()
        self.cpuUsageCollector = BaseCpuUsageCollector(logger: logger,
                                                       configProvider: configProvider,
                                                       eventProcessor: eventProcessor,
                                                       timeProvider: timeProvider,
                                                       cpuUsageCalculator: cpuUsageCalculator,
                                                       sysCtl: sysCtl)
        self.memoryUsageCollector = BaseMemoryUsageCollector(logger: logger,
                                                             configProvider: configProvider,
                                                             eventProcessor: eventProcessor,
                                                             timeProvider: timeProvider,
                                                             memoryUsageCalculator: memoryUsageCalculator,
                                                             sysCtl: sysCtl)
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? AttributeConstants.unknown
        self.appLaunchCollector = BaseAppLaunchCollector(logger: logger,
                                                         timeProvider: timeProvider,
                                                         eventProcessor: eventProcessor,
                                                         sysCtl: sysCtl,
                                                         userDefaultStorage: userDefaultStorage,
                                                         currentAppVersion: appVersion)
        self.customEventCollector = BaseCustomEventCollector(logger: logger,
                                                             eventProcessor: eventProcessor,
                                                             timeProvider: timeProvider,
                                                             configProvider: configProvider)
        self.networkChangeCollector = BaseNetworkChangeCollector(logger: logger,
                                                                 eventProcessor: eventProcessor,
                                                                 timeProvider: timeProvider)
        self.userTriggeredEventCollector = BaseUserTriggeredEventCollector(eventProcessor: eventProcessor,
                                                                           timeProvider: timeProvider)
        self.dataCleanupService = BaseDataCleanupService(eventStore: eventStore,
                                                         sessionStore: sessionStore,
                                                         logger: logger,
                                                         sessionManager: sessionManager)
        self.client = client
        self.httpEventCollector = BaseHttpEventCollector(logger: logger,
                                                         eventProcessor: eventProcessor,
                                                         timeProvider: timeProvider,
                                                         urlSessionTaskSwizzler: URLSessionTaskSwizzler(),
                                                         httpInterceptorCallbacks: HttpInterceptorCallbacks(),
                                                         client: client,
                                                         configProvider: configProvider)
    }
}
