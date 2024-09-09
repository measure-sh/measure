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
    let measureInitializer: MeasureInitializer
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
    private let lifecycleObserver: LifecycleObserver

    init(_ measureInitializer: MeasureInitializer) {
        self.measureInitializer = measureInitializer
        self.lifecycleObserver = LifecycleObserver()
        self.logger.log(level: .debug, message: "Starting Measure SDK", error: nil)
        self.sessionManager.start()
        self.lifecycleObserver.applicationDidEnterBackground = applicationDidEnterBackground
        self.lifecycleObserver.applicationWillEnterForeground = applicationWillEnterForeground
        self.lifecycleObserver.applicationWillTerminate = applicationWillTerminate
        let dic = ["2": "B", "1": "A", "3": "C"]

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: dic, options: .prettyPrinted)
            // here "jsonData" is the dictionary encoded in JSON data

            self.eventProcessor.track(data: jsonData, timestamp: 1_000_000_000_000, type: .exception)
        } catch {
            print(error.localizedDescription)
        }
    }

    private func applicationDidEnterBackground() {
        sessionManager.applicationDidEnterBackground()
    }

    private func applicationWillEnterForeground() {
        sessionManager.applicationWillEnterForeground()
    }

    private func applicationWillTerminate() {
        sessionManager.applicationWillTerminate()
    }
}
