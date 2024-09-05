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
    private let lifecycleObserver: LifecycleObserver

    init(_ measureInitializer: MeasureInitializer) {
        self.measureInitializer = measureInitializer
        self.lifecycleObserver = LifecycleObserver()
        self.logger.log(level: .debug, message: "Starting Measure SDK", error: nil)
        self.sessionManager.start()
        self.lifecycleObserver.applicationDidEnterBackground = applicationDidEnterBackground
        self.lifecycleObserver.applicationWillEnterForeground = applicationWillEnterForeground
        self.lifecycleObserver.applicationWillTerminate = applicationWillTerminate
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
