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
    var signalProcessor: SignalProcessor { get }
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
    var periodicExporter: PeriodicExporter { get }
    var heartbeat: Heartbeat { get }
    var exporter: Exporter { get }
    var batchStore: BatchStore { get }
    var batchCreator: BatchCreator { get }
    var lifecycleCollector: LifecycleCollector { get }
    var cpuUsageCollector: CpuUsageCollector { get }
    var memoryUsageCollector: MemoryUsageCollector { get }
    var cpuUsageCalculator: CpuUsageCalculator { get }
    var memoryUsageCalculator: MemoryUsageCalculator { get }
    var sysCtl: SysCtl { get }
    var appLaunchCollector: AppLaunchCollector { get }
    var httpEventCollector: HttpEventCollector { get }
    var networkChangeCollector: NetworkChangeCollector { get }
    var customEventCollector: CustomEventCollector { get }
    var userTriggeredEventCollector: UserTriggeredEventCollector { get }
    var dataCleanupService: DataCleanupService { get }
    var attachmentProcessor: AttachmentProcessor { get }
    var layoutSnapshotGenerator: LayoutSnapshotGenerator { get }
    var userPermissionManager: UserPermissionManager { get }
    var svgGenerator: SvgGenerator { get }
    var appVersionInfo: AppVersionInfo { get }
    var httpEventValidator: HttpEventValidator { get }
    var traceSampler: TraceSampler { get }
    var randomizer: Randomizer { get }
    var spanProcessor: SpanProcessor { get }
    var tracer: Tracer { get }
    var spanCollector: SpanCollector { get }
<<<<<<< HEAD
    var spanStore: SpanStore { get }
=======
>>>>>>> feat-ios-performance-tracing
}

/// `BaseMeasureInitializer` is responsible for setting up the internal configuration
///
/// Properties:
/// - `configProvider`: `ConfigProvider` object managing the `Config` for the Measure.
/// - `client`: `Client` object managing the `Config` for the Measure.
/// - `logger`: `Logger` object used for logging messages and errors within the Measure.
/// - `sessionManager`: `SessionManager` for the Measure.
/// - `idProvider`: `IdProvider` object used to generate unique identifiers.
/// - `timeProvider`: `TimeProvider` object providing time-related information.
/// - `userDefaultStorage`: `UserDefaultStorage` object used to manage userDefaults data
/// - `appAttributeProcessor`: `AppAttributeProcessor` object used to process app related info.
/// - `deviceAttributeProcessor`: `DeviceAttributeProcessor` object used to process device related info.
/// - `installationIdAttributeProcessor`: `InstallationIdAttributeProcessor` object used to process installation_id.
/// - `networkStateAttributeProcessor`: `NetworkStateAttributeProcessor` object used to process network info.
/// - `userAttributeProcessor`: `UserAttributeProcessor` object used to process user_id.
/// - `attributeProcessors`: An array containing all the `AttributeProcessor`.
/// - `signalProcessor`: `SignalProcessor` object used to track events, traces and spans.
/// - `crashReportManager`: `CrashReportManager` object used to manage crash reports.
/// - `crashDataPersistence`: `CrashDataPersistence` object used to manage crash `Attributes` and metadata.
/// - `systemFileManager`: `SystemFileManager` object used to manage files in local file system.
/// - `systemCrashReporter`: `SystemCrashReporter` object generates crash reports.
/// - `coreDataManager`: `CoreDataManager` object that generates and manages core data persistance and contexts
/// - `sessionStore`: `SessionStore` object that manages `Session` related operations
/// - `eventStore`: `EventStore` object that manages `Event` related operations
/// - `spanStore`: `SpanStore` object that manages `Span` related operations
/// - `gestureCollector`: `GestureCollector` object which is responsible for detecting and saving gesture related data.
/// - `lifecycleCollector`: `LifecycleCollector` object which is responsible for detecting and saving ViewController lifecycle events.
/// - `cpuUsageCollector`: `CpuUsageCollector` object which is responsible for detecting and saving CPU usage data.
/// - `memoryUsageCollector`: `MemoryUsageCollector` object which is responsible for detecting and saving memory usage data.
/// - `appLaunchCollector`: `AppLaunchCollector` object which is responsible for detecting and saving launch related events.
/// - `httpEventCollector`: `HttpEventCollector` object that collects HTTP request data.
/// - `userTriggeredEventCollector`: `UserTriggeredEventCollector` object which is responsible for tracking user triggered events.
/// - `gestureTargetFinder`: `GestureTargetFinder` object that determines which view is handling the gesture.
/// - `cpuUsageCalculator`: `CpuUsageCalculator` object that generates CPU usage data.
/// - `memoryUsageCalculator`: `MemoryUsageCalculator` object that generates memory usage data.
/// - `customEventCollector`: `CustomEventCollector` object that triggers custom events.
/// - `spanCollector`: `SpanCollector`object that generates span data.
/// - `sysCtl`: `SysCtl` object which provides sysctl functionalities.
/// - `httpClient`: `HttpClient` object that handles HTTP requests.
/// - `networkClient`: `NetworkClient` object is responsible for initializing the network configuration and executing API requests.
/// - `heartbeat`: `Heartbeat` object that emits a pulse every 30 seconds.
/// - `periodicExporter`: `PeriodicExporter` object that exports events periodically to server.
/// - `exporter`: `Exporter` object that exports a single batch.
/// - `batchStore`: `BatchStore` object that manages `Batch` related operations
/// - `batchCreator`: `BatchCreator` object used to create a batch.
/// - `dataCleanupService`: `DataCleanupService` object responsible for clearing stale data
/// - `attachmentProcessor`: `AttachmentProcessor` object responsible for generating and managing screenshots.
/// - `svgGenerator`: `SvgGenerator` object responsible for generating layout snapshot svg.
/// - `layoutSnapshotGenerator`: `LayoutSnapshotGenerator` object responsible for generating a layout snapshot.
/// - `userPermissionManager`: `UserPermissionManager` object managing user permissions.
/// - `appVersionInfo`: `AppVersionInfo` object that returns app information like app version and build number
/// - `httpEventValidator`: `HttpEventValidator` object that lets you check if a http event should be tracked or not.
/// - `traceSampler`: `TraceSampler` object that manages trace sampling.
/// - `randomizer`: `Randomizer` object that generates random numbers.
/// - `spanProcessor`: `SpanProcessor` object that processes spans at different stages of their lifecycle.
/// - `tracer`: `Tracer` object to create and manage tracing spans.
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
    let signalProcessor: SignalProcessor
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
    let periodicExporter: PeriodicExporter
    let exporter: Exporter
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
    let traceSampler: TraceSampler
    let randomizer: Randomizer
    let spanProcessor: SpanProcessor
    let spanCollector: SpanCollector
    let tracer: Tracer
<<<<<<< HEAD
    let spanStore: SpanStore
=======
>>>>>>> feat-ios-performance-tracing

    init(config: MeasureConfig, // swiftlint:disable:this function_body_length
         client: Client) {
        let defaultConfig = Config(enableLogging: config.enableLogging,
                                   samplingRateForErrorFreeSessions: config.samplingRateForErrorFreeSessions,
                                   traceSamplingRate: config.traceSamplingRate,
                                   trackHttpHeaders: config.trackHttpHeaders,
                                   trackHttpBody: config.trackHttpBody,
                                   httpHeadersBlocklist: config.httpHeadersBlocklist,
                                   httpUrlBlocklist: config.httpUrlBlocklist,
                                   httpUrlAllowlist: config.httpUrlAllowlist,
                                   autoStart: config.autoStart)

        self.configProvider = BaseConfigProvider(defaultConfig: defaultConfig,
                                                 configLoader: BaseConfigLoader())
        self.timeProvider = BaseTimeProvider()
        self.appVersionInfo = BaseAppVersionInfo()
        self.logger = MeasureLogger(enabled: configProvider.enableLogging)
        self.idProvider = UUIDProvider()
        self.coreDataManager = BaseCoreDataManager(logger: logger)
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
                                                 versionCode: FrameworkInfo.version,
                                                 appVersionInfo: appVersionInfo)
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
        self.attachmentProcessor = BaseAttachmentProcessor(logger: logger,
                                                           fileManager: systemFileManager,
                                                           idProvider: idProvider)
        self.userPermissionManager = BaseUserPermissionManager()
        self.svgGenerator = BaseSvgGenerator()
        self.layoutSnapshotGenerator = BaseLayoutSnapshotGenerator(logger: logger,
                                                                   configProvider: configProvider,
                                                                   timeProvider: timeProvider,
                                                                   attachmentProcessor: attachmentProcessor,
                                                                   svgGenerator: svgGenerator)
<<<<<<< HEAD
        self.spanStore = BaseSpanStore(coreDataManager: coreDataManager,
                                       logger: logger)
        self.signalProcessor = BaseSignalProcessor(logger: logger,
                                                   idProvider: idProvider,
                                                   sessionManager: sessionManager,
                                                   attributeProcessors: attributeProcessors,
                                                   configProvider: configProvider,
                                                   timeProvider: timeProvider,
                                                   crashDataPersistence: crashDataPersistence,
                                                   eventStore: eventStore,
                                                   spanStore: spanStore)
=======
        self.signalProcessor = BaseSignalProcessor(logger: logger,
                                                  idProvider: idProvider,
                                                  sessionManager: sessionManager,
                                                  attributeProcessors: attributeProcessors,
                                                  configProvider: configProvider,
                                                  timeProvider: timeProvider,
                                                  crashDataPersistence: crashDataPersistence,
                                                  eventStore: eventStore)
>>>>>>> feat-ios-performance-tracing
        self.systemCrashReporter = BaseSystemCrashReporter(logger: logger)
        self.crashReportManager = CrashReportingManager(logger: logger,
                                                        signalProcessor: signalProcessor,
                                                        crashDataPersistence: crashDataPersistence,
                                                        crashReporter: systemCrashReporter,
                                                        systemFileManager: systemFileManager,
                                                        idProvider: idProvider,
                                                        configProvider: configProvider)
        self.gestureTargetFinder = BaseGestureTargetFinder()
        self.gestureCollector = BaseGestureCollector(logger: logger,
                                                     signalProcessor: signalProcessor,
                                                     timeProvider: timeProvider,
                                                     configProvider: configProvider,
                                                     gestureTargetFinder: gestureTargetFinder,
                                                     layoutSnapshotGenerator: layoutSnapshotGenerator,
                                                     systemFileManager: systemFileManager)
        self.httpClient = BaseHttpClient(logger: logger, configProvider: configProvider)
        self.networkClient = BaseNetworkClient(client: client,
                                               httpClient: httpClient,
                                               eventSerializer: EventSerializer(),
                                               systemFileManager: systemFileManager)
        self.heartbeat = BaseHeartbeat()
        self.batchStore = BaseBatchStore(coreDataManager: coreDataManager,
                                         logger: logger)
        self.batchCreator = BaseBatchCreator(logger: logger,
                                             idProvider: idProvider,
                                             configProvider: configProvider,
                                             timeProvider: timeProvider,
                                             eventStore: eventStore,
<<<<<<< HEAD
                                             batchStore: batchStore,
                                             spanStore: spanStore)
        self.exporter = BaseExporter(logger: logger,
                                     networkClient: networkClient,
                                     batchCreator: batchCreator,
                                     batchStore: batchStore,
                                     eventStore: eventStore,
                                     spanStore: spanStore)
        self.periodicExporter = BasePeriodicExporter(logger: logger,
                                                     configProvider: configProvider,
                                                     timeProvider: timeProvider,
                                                     heartbeat: heartbeat,
                                                     exporter: exporter,
                                                     dispatchQueue: MeasureQueue.periodicEventExporter)
=======
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
>>>>>>> feat-ios-performance-tracing
        self.lifecycleCollector = BaseLifecycleCollector(signalProcessor: signalProcessor,
                                                         timeProvider: timeProvider,
                                                         logger: logger)
        self.cpuUsageCalculator = BaseCpuUsageCalculator()
        self.memoryUsageCalculator = BaseMemoryUsageCalculator()
        self.sysCtl = BaseSysCtl()
        self.cpuUsageCollector = BaseCpuUsageCollector(logger: logger,
                                                       configProvider: configProvider,
                                                       signalProcessor: signalProcessor,
                                                       timeProvider: timeProvider,
                                                       cpuUsageCalculator: cpuUsageCalculator,
                                                       sysCtl: sysCtl)
        self.memoryUsageCollector = BaseMemoryUsageCollector(logger: logger,
                                                             configProvider: configProvider,
                                                             signalProcessor: signalProcessor,
                                                             timeProvider: timeProvider,
                                                             memoryUsageCalculator: memoryUsageCalculator,
                                                             sysCtl: sysCtl)
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? AttributeConstants.unknown
        self.appLaunchCollector = BaseAppLaunchCollector(logger: logger,
                                                         timeProvider: timeProvider,
                                                         signalProcessor: signalProcessor,
                                                         sysCtl: sysCtl,
                                                         userDefaultStorage: userDefaultStorage,
                                                         currentAppVersion: appVersion)
        self.networkChangeCollector = BaseNetworkChangeCollector(logger: logger,
                                                                 signalProcessor: signalProcessor,
                                                                 timeProvider: timeProvider)
        self.customEventCollector = BaseCustomEventCollector(logger: logger,
                                                             signalProcessor: signalProcessor,
                                                             timeProvider: timeProvider,
                                                             configProvider: configProvider)
        self.userTriggeredEventCollector = BaseUserTriggeredEventCollector(signalProcessor: signalProcessor,
                                                                           timeProvider: timeProvider,
                                                                           logger: logger)
        self.dataCleanupService = BaseDataCleanupService(eventStore: eventStore,
                                                         spanStore: spanStore,
                                                         sessionStore: sessionStore,
                                                         logger: logger,
                                                         sessionManager: sessionManager)
        self.client = client
        self.httpEventValidator = BaseHttpEventValidator()
        self.httpEventCollector = BaseHttpEventCollector(logger: logger,
                                                         signalProcessor: signalProcessor,
                                                         timeProvider: timeProvider,
                                                         urlSessionTaskSwizzler: URLSessionTaskSwizzler(),
                                                         httpInterceptorCallbacks: HttpInterceptorCallbacks(),
                                                         client: client,
                                                         configProvider: configProvider,
                                                         httpEventValidator: httpEventValidator)
        self.randomizer = BaseRandomizer()
        self.traceSampler = BaseTraceSampler(configProvider: configProvider, randomizer: randomizer)
        self.spanProcessor = BaseSpanProcessor(logger: logger,
                                               signalProcessor: signalProcessor,
                                               attributeProcessors: attributeProcessors,
                                               configProvider: configProvider)
        self.tracer = MsrTracer(logger: logger,
                                idProvider: idProvider,
                                timeProvider: timeProvider,
                                spanProcessor: spanProcessor,
                                sessionManager: sessionManager,
                                traceSampler: traceSampler)
        self.spanCollector = BaseSpanCollector(tracer: tracer)
    }
}
