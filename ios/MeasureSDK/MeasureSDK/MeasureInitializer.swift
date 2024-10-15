//
//  MeasureInitializer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation

/// Protocol defining the requirements for initializing the Measure SDK.
protocol MeasureInitializer {
    var configProvider: ConfigProvider { get }
    var client: Client { get }
    var logger: Logger { get }
    var sessionManager: SessionManager { get }
    var idProvider: IdProvider { get }
    var timeProvider: TimeProvider { get }
    var systemTime: SystemTime { get }
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
/// - `systemTime`: `SystemTime` object which is a wrapper around the existing `Date` class.
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
/// - `gestureCollector`: `GestureCollector` object is responsible for detecting and saving gesture related data.
/// - `gestureTargetFinder`: `GestureTargetFinder` object that determines which view is handling the gesture.
///
final class BaseMeasureInitializer: MeasureInitializer {
    let configProvider: ConfigProvider
    let client: Client
    let logger: Logger
    let sessionManager: SessionManager
    let idProvider: IdProvider
    let timeProvider: TimeProvider
    let systemTime: SystemTime
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

    init(config: MeasureConfig, // swiftlint:disable:this function_body_length
         client: Client) {
        let defaultConfig = Config(enableLogging: config.enableLogging,
                                   trackScreenshotOnCrash: config.trackScreenshotOnCrash,
                                   sessionSamplingRate: config.sessionSamplingRate)

        self.configProvider = BaseConfigProvider(defaultConfig: defaultConfig,
                                                 configLoader: BaseConfigLoader())
        self.systemTime = BaseSystemTime()
        self.timeProvider = SystemTimeProvider(systemTime: self.systemTime)
        self.logger = MeasureLogger(enabled: configProvider.enableLogging)
        self.idProvider = UUIDProvider()
        self.coreDataManager = BaseCoreDataManager()
        self.sessionStore = BaseSessionStore(coreDataManager: coreDataManager,
                                             logger: logger)
        self.eventStore = BaseEventStore(coreDataManager: coreDataManager,
                                         logger: logger)
        self.sessionManager = BaseSessionManager(idProvider: idProvider,
                                                 logger: logger,
                                                 timeProvider: timeProvider,
                                                 configProvider: configProvider,
                                                 sessionStore: sessionStore)
        self.userDefaultStorage = BaseUserDefaultStorage()
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
                                                 systemTime: systemTime,
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
        self.client = client
    }
}
