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
    private var logger: Logger {
        return measureInitializer.logger
    }
    private var sessionManager: SessionManager {
        return measureInitializer.sessionManager
    }
    private var timeProvider: TimeProvider {
        return measureInitializer.timeProvider
    }
    private var configProvider: ConfigProvider {
        return measureInitializer.configProvider
    }
    private var systemTime: SystemTime {
        return measureInitializer.systemTime
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
    private let lifecycleObserver: LifecycleObserver

    init(_ measureInitializer: MeasureInitializer) {
        self.measureInitializer = measureInitializer
        self.lifecycleObserver = LifecycleObserver()
        self.logger.log(level: .info, message: "Starting Measure SDK", error: nil)
        self.sessionManager.start()
        self.lifecycleObserver.applicationDidEnterBackground = applicationDidEnterBackground
        self.lifecycleObserver.applicationWillEnterForeground = applicationWillEnterForeground
        self.lifecycleObserver.applicationWillTerminate = applicationWillTerminate
        self.crashDataPersistence.prepareCrashFile()
        self.crashDataPersistence.sessionId = sessionManager.sessionId

        self.crashReportManager.enableCrashReporting()
        self.crashReportManager.trackException()
        self.gestureCollector.enable()
    }

    private func applicationDidEnterBackground() {
        sessionManager.applicationDidEnterBackground()
        self.crashDataPersistence.isForeground = false
    }

    private func applicationWillEnterForeground() {
        sessionManager.applicationWillEnterForeground()
        self.crashDataPersistence.isForeground = true
    }

    private func applicationWillTerminate() {
        sessionManager.applicationWillTerminate()
    }
}
