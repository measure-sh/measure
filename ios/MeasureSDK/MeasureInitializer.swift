//
//  MeasureInitializer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation
import UIKit

/// Protocol defining the requirements for initializing the Measure SDK.
protocol MeasureInitializer {
    var configProvider: ConfigProvider { get }
    var client: Client { get }
    var logger: Logger { get }
    var sessionManager: SessionManager { get }
    var idProvider: IdProvider { get }
    var timeProvider: TimeProvider { get }
    var userDefaultStorage: UserDefaultStorage { get }
    var appAttributeProcessor: AppAttributeProcessor { get }
    var deviceAttributeProcessor: DeviceAttributeProcessor { get }
    var installationIdAttributeProcessor: InstallationIdAttributeProcessor { get }
    var networkStateAttributeProcessor: NetworkStateAttributeProcessor { get }
    var userAttributeProcessor: UserAttributeProcessor { get }
    var attributeProcessors: [AttributeProcessor] { get }
    var eventProcessor: EventProcessor { get }
    var crashReportManager: CrashReportManager { get }
    var crashDataPersistence: CrashDataPersistence { get set }
    var systemFileManager: SystemFileManager { get }
    var systemCrashReporter: SystemCrashReporter { get }
    var coreDataManager: CoreDataManager { get }
    var sessionStore: SessionStore { get }
    var eventStore: EventStore { get }
    var gestureCollector: GestureCollector { get }
    var gestureTargetFinder: GestureTargetFinder { get }
    var networkClient: NetworkClient { get }
    var httpClient: HttpClient { get }
    var periodicEventExporter: PeriodicEventExporter { get }
    var heartbeat: Heartbeat { get }
    var eventExporter: EventExporter { get }
    var batchStore: BatchStore { get }
    var batchCreator: BatchCreator { get }
    var lifecycleCollector: LifecycleCollector { get }
    var cpuUsageCollector: CpuUsageCollector { get }
    var memoryUsageCollector: MemoryUsageCollector { get }
    var cpuUsageCalculator: CpuUsageCalculator { get }
    var memoryUsageCalculator: MemoryUsageCalculator { get }
    var sysCtl: SysCtl { get }
    var appLaunchCollector: AppLaunchCollector { get }
}

/// `BaseMeasureInitializer` is responsible for setting up the internal configuration
///
/// Properties:
/// - `configProvider`: `ConfigProvider` object managing the `Config` for the MeasureSDK.
/// - `client`: `Client` object managing the `Config` for the MeasureSDK.
/// - `logger`: `Logger` object used for logging messages and errors within the MeasureSDK.
/// - `sessionManager`: `SessionManager` for the MeasureSDK.
/// - `idProvider`: `IdProvider` object used to generate unique identifiers.
/// - `timeProvider`: `TimeProvider` object providing time-related information.
/// - `userDefaultStorage`: `UserDefaultStorage` object used to manage userDefaults data
/// - `appAttributeProcessor`: `AppAttributeProcessor` object used to process app related info.
/// - `deviceAttributeProcessor`: `DeviceAttributeProcessor` object used to process device related info.
/// - `installationIdAttributeProcessor`: `InstallationIdAttributeProcessor` object used to process installation_id.
/// - `networkStateAttributeProcessor`: `NetworkStateAttributeProcessor` object used to process network info.
/// - `userAttributeProcessor`: `UserAttributeProcessor` object used to process user_id.
/// - `attributeProcessors`: An array containing all the `AttributeProcessor`.
/// - `eventProcessor`: `EventProcessor` object used to track events
/// - `crashReportManager`: `CrashReportManager` object used to manage crash reports.
/// - `crashDataPersistence`: `CrashDataPersistence` object used to manage crash `Attributes` and metadata.
/// - `systemFileManager`: `SystemFileManager` object used to manage files in local file system.
/// - `systemCrashReporter`: `SystemCrashReporter` object generates crash reports.
/// - `coreDataManager`: `CoreDataManager` object that generates and manages core data persistance and contexts
/// - `sessionStore`: `SessionStore` object that manages `Session` related operations
/// - `eventStore`: `EventStore` object that manages `Event` related operations
/// - `gestureCollector`: `GestureCollector` object which is responsible for detecting and saving gesture related data.
/// - `lifecycleCollector`: `LifecycleCollector` object which is responsible for detecting and saving ViewController lifecycle events.
/// - `cpuUsageCollector`: `CpuUsageCollector` object which is responsible for detecting and saving CPU usage data.
/// - `memoryUsageCollector`: `MemoryUsageCollector` object which is responsible for detecting and saving memory usage data.
/// - `appLaunchCollector`: `AppLaunchCollector` object which is responsible for detecting and saving launch related events.
/// - `gestureTargetFinder`: `GestureTargetFinder` object that determines which view is handling the gesture.
/// - `cpuUsageCalculator`: `CpuUsageCalculator` object that generates CPU usage data.
/// - `memoryUsageCalculator`: `MemoryUsageCalculator` object that generates memory usage data.
/// - `sysCtl`: `SysCtl` object which provides sysctl functionalities.
/// - `httpClient`: `HttpClient` object that handles HTTP requests.
/// - `networkClient`: `NetworkClient` object is responsible for initializing the network configuration and executing API requests.
/// - `heartbeat`: `Heartbeat` object that emits a pulse every 30 seconds.
/// - `periodicEventExporter`: `PeriodicEventExporter` object that exports events periodically to server.
/// - `eventExporter`: `EventExporter` object that exports a single batch.
/// - `batchStore`: `BatchStore` object that manages `Batch` related operations
/// - `batchCreator`: `BatchCreator` object used to create a batch.
///
final class BaseMeasureInitializer: MeasureInitializer {
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

    init(config: MeasureConfig, // swiftlint:disable:this function_body_length
         client: Client) {
        let defaultConfig = Config(enableLogging: config.enableLogging,
                                   trackScreenshotOnCrash: config.trackScreenshotOnCrash,
                                   sessionSamplingRate: config.sessionSamplingRate)

        self.configProvider = BaseConfigProvider(defaultConfig: defaultConfig,
                                                 configLoader: BaseConfigLoader())
        self.timeProvider = BaseTimeProvider()
        self.logger = MeasureLogger(enabled: configProvider.enableLogging)
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
                                                 userDefaultStorage: userDefaultStorage,
                                                 versionCode: FrameworkInfo.version)
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
        self.client = client
    }
}
