//
//  MeasureInternal.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation
import UIKit

/// Internal implementation of the Measure SDK.
///
/// This class initializes the Measure SDK and hides the internal dependencies from the public API.
///
final class MeasureInternal {
    var measureInitializer: MeasureInitializer
    var logger: Logger {
        return measureInitializer.logger
    }
    private var client: Client {
        return measureInitializer.client
    }
    var sessionManager: SessionManager {
        return measureInitializer.sessionManager
    }
    var timeProvider: TimeProvider {
        return measureInitializer.timeProvider
    }
    var idProvider: IdProvider {
        return measureInitializer.idProvider
    }
    private var configProvider: ConfigProvider {
        return measureInitializer.configProvider
    }
    private var appAttributeProcessor: AppAttributeProcessor {
        return measureInitializer.appAttributeProcessor
    }
    private var deviceAttributeProcessor: DeviceAttributeProcessor {
        return measureInitializer.deviceAttributeProcessor
    }
    private var installationIdAttributeProcessor: InstallationIdAttributeProcessor {
        return measureInitializer.installationIdAttributeProcessor
    }
    private var networkStateAttributeProcessor: NetworkStateAttributeProcessor {
        return measureInitializer.networkStateAttributeProcessor
    }
    private var userAttributeProcessor: UserAttributeProcessor {
        return measureInitializer.userAttributeProcessor
    }
    private var userDefaultStorage: UserDefaultStorage {
        return measureInitializer.userDefaultStorage
    }
    private var attributeProcessors: [AttributeProcessor] {
        return measureInitializer.attributeProcessors
    }
    private var eventProcessor: EventProcessor {
        return measureInitializer.eventProcessor
    }
    private var crashReportManager: CrashReportManager {
        return measureInitializer.crashReportManager
    }
    private var crashDataPersistence: CrashDataPersistence {
        get {
            return measureInitializer.crashDataPersistence
        }
        set {
            measureInitializer.crashDataPersistence = newValue
        }
    }
    private var systemFileManager: SystemFileManager {
        return measureInitializer.systemFileManager
    }
    private var sessionStore: SessionStore {
        return measureInitializer.sessionStore
    }
    private var coreDataManager: CoreDataManager {
        return measureInitializer.coreDataManager
    }
    private var eventStore: EventStore {
        return measureInitializer.eventStore
    }
    private var gestureCollector: GestureCollector {
        return measureInitializer.gestureCollector
    }
    private var networkClient: NetworkClient {
        return measureInitializer.networkClient
    }
    private var httpClient: HttpClient {
        return measureInitializer.httpClient
    }
    private var heartbeat: Heartbeat {
        return measureInitializer.heartbeat
    }
    private var periodicEventExporter: PeriodicEventExporter {
        return measureInitializer.periodicEventExporter
    }
    private var lifecycleCollector: LifecycleCollector {
        return measureInitializer.lifecycleCollector
    }
    private var cpuUsageCollector: CpuUsageCollector {
        return measureInitializer.cpuUsageCollector
    }
    private var memoryUsageCollector: MemoryUsageCollector {
        return measureInitializer.memoryUsageCollector
    }
    private var appLaunchCollector: AppLaunchCollector {
        return measureInitializer.appLaunchCollector
    }
    private var httpEventCollector: HttpEventCollector {
        return measureInitializer.httpEventCollector
    }
    private var networkChangeCollector: NetworkChangeCollector {
        return measureInitializer.networkChangeCollector
    }
    var customEventCollector: CustomEventCollector {
        return measureInitializer.customEventCollector
    }
    var userTriggeredEventCollector: UserTriggeredEventCollector {
        return measureInitializer.userTriggeredEventCollector
    }
    var dataCleanupService: DataCleanupService {
        return measureInitializer.dataCleanupService
    }
    var attachmentProcessor: AttachmentProcessor {
        return measureInitializer.attachmentProcessor
    }
    var traceSampler: TraceSampler {
        return measureInitializer.traceSampler
    }
    private let lifecycleObserver: LifecycleObserver
    private var isStarted: Bool = false

    init(_ measureInitializer: MeasureInitializer) {
        self.measureInitializer = measureInitializer
        self.lifecycleObserver = LifecycleObserver()
        self.lifecycleObserver.applicationDidEnterBackground = applicationDidEnterBackground
        self.lifecycleObserver.applicationWillEnterForeground = applicationWillEnterForeground
        self.lifecycleObserver.applicationWillTerminate = applicationWillTerminate
        self.logger.log(level: .info, message: "Initializing Measure SDK", error: nil, data: nil)
        self.sessionManager.setPreviousSessionCrashed(crashReportManager.hasPendingCrashReport)
        self.sessionManager.start()
        self.crashDataPersistence.prepareCrashFile()
        self.crashDataPersistence.sessionId = sessionManager.sessionId
        self.crashReportManager.trackException()
        registerAlwaysOnCollectors()
        if configProvider.autoStart {
            start()
        }
    }

    func start() {
        if !isStarted {
            self.logger.log(level: .info, message: "Starting Measure SDK", error: nil, data: nil)
            registedCollectors()
            isStarted = true
        }
    }

    func stop() {
        if isStarted && !configProvider.autoStart {
            self.logger.log(level: .info, message: "Stopping Measure SDK", error: nil, data: nil)
            unregisterCollectors()
            isStarted = false
        }
    }

    func setUserId(_ userId: String) {
        userAttributeProcessor.setUserId(userId)
    }

    func clearUserId() {
        userAttributeProcessor.clearUserId()
    }

    private func applicationDidEnterBackground() {
        self.crashDataPersistence.isForeground = false
        self.sessionManager.applicationDidEnterBackground()
        self.periodicEventExporter.applicationDidEnterBackground()
        self.lifecycleCollector.applicationDidEnterBackground()
        self.cpuUsageCollector.pause()
        self.memoryUsageCollector.pause()
        self.dataCleanupService.clearStaleData()
    }

    private func applicationWillEnterForeground() {
        self.crashDataPersistence.isForeground = true
        self.sessionManager.applicationWillEnterForeground()
        self.periodicEventExporter.applicationWillEnterForeground()
        self.lifecycleCollector.applicationWillEnterForeground()
        self.cpuUsageCollector.resume()
        self.memoryUsageCollector.resume()
    }

    private func applicationWillTerminate() {
        self.sessionManager.applicationWillTerminate()
        self.lifecycleCollector.applicationWillTerminate()
    }

    private func registedCollectors() {
        self.customEventCollector.enable()
        self.userTriggeredEventCollector.enable()
        self.cpuUsageCollector.enable()
        self.memoryUsageCollector.enable()
        self.periodicEventExporter.enable()
        self.httpEventCollector.enable()
        self.networkChangeCollector.enable()
        self.lifecycleCollector.enable()
        self.crashReportManager.enable()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            if let window = UIApplication.shared.windows.first {
                self.gestureCollector.enable(for: window)
            }
        }
    }

    private func unregisterCollectors() {
        self.customEventCollector.disable()
        self.userTriggeredEventCollector.disable()
        self.cpuUsageCollector.disable()
        self.memoryUsageCollector.disable()
        self.periodicEventExporter.disable()
        self.httpEventCollector.disable()
        self.networkChangeCollector.disable()
        self.gestureCollector.disable()
        self.lifecycleCollector.disable()
        self.crashReportManager.disable()
    }

    private func registerAlwaysOnCollectors() {
        self.appLaunchCollector.enable()
    }
}
