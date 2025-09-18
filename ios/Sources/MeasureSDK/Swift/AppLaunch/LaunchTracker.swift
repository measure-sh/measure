//
//  LaunchTracker.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 12/11/24.
//

import Foundation
import UIKit

// This variable is declared in the global scope as the `ActivePrewarm` environment variable gets removed as soon as UIApplication's lifecycle events are called.
let isActivePrewarm: Bool = {
    let environment = ProcessInfo.processInfo.environment
    return environment["ActivePrewarm"] == "1"
}()

enum LaunchState {
    case launching              // initial cold start, waiting for first active
    case inactiveDuringLaunch   // resigned before becoming active → skip
    case active                 // app active at least once
    case foregrounded           // returned from background
}

protocol LaunchTracker {
    func applicationWillEnterForeground()
    func applicationDidBecomeActive()
    func applicationWillResignActive()
}

final class BaseLaunchTracker: LaunchTracker {
    private let launchCallbacks: LaunchCallbacks
    private let timeProvider: TimeProvider
    private let sysCtl: SysCtl
    private let logger: Logger
    private let userDefaultStorage: UserDefaultStorage
    private let currentAppVersion: String
    private var state: LaunchState
    private var willEnterForegroundTimestamp: UnsignedNumber?

    init(launchCallbacks: LaunchCallbacks,
         timeProvider: TimeProvider,
         sysCtl: SysCtl,
         logger: Logger,
         userDefaultStorage: UserDefaultStorage,
         currentAppVersion: String) {
        self.launchCallbacks = launchCallbacks
        self.timeProvider = timeProvider
        self.sysCtl = sysCtl
        self.logger = logger
        self.userDefaultStorage = userDefaultStorage
        self.currentAppVersion = currentAppVersion
        self.state = .launching
    }

    func applicationWillResignActive() {
        if state == .launching {
            state = .inactiveDuringLaunch
            logger.log(level: .info, message: "Resigned before active, skipping launch tracking.", error: nil, data: nil)
        }
    }

    func applicationDidBecomeActive() {
        switch state {
        case .launching:
            processAppLaunchData()
            state = .active
        case .foregrounded:
            if let timestamp = willEnterForegroundTimestamp {
                generateHotLaunchData(appVisibleUptime: timestamp,
                                      onNextDrawUptime: UnsignedNumber(timeProvider.millisTime))
            }
            willEnterForegroundTimestamp = nil
            state = .active
        case .inactiveDuringLaunch:
            // skip as launch is marked inactive.
            break
        default:
            break
        }
    }

    func applicationWillEnterForeground() {
        willEnterForegroundTimestamp = UnsignedNumber(timeProvider.millisTime)
        if state != .launching {
            state = .foregrounded
        }
    }

    private func processAppLaunchData() {
        guard let processStart = sysCtl.getProcessStartTime(),
              let currentSystemBootTime = sysCtl.getSystemBootTime() else {
            logger.log(level: .error, message: "Could not get process start time.", error: nil, data: nil)
            return
        }

        guard !isActivePrewarm else {
            logger.log(level: .error, message: "Skipping launch data collection as app is prewarmed.", error: nil, data: nil)
            return
        }

        let now = UnsignedNumber(timeProvider.now())
        let currentLaunchData = LaunchData(appVersion: currentAppVersion, timeSinceLastBoot: currentSystemBootTime)

        // Mark a launch as cold launch if recent launch data is not available
        guard let recentLaunch = userDefaultStorage.getRecentLaunchData() else {
            generateColdLaunchData(processStartUptime: processStart, onNextDrawUptime: now)
            userDefaultStorage.setRecentLaunchData(currentLaunchData)
            return
        }

        if recentLaunch.appVersion != currentAppVersion { // if app is updated, mark it as a cold launch
            generateColdLaunchData(processStartUptime: processStart, onNextDrawUptime: now)
        } else if recentLaunch.timeSinceLastBoot == currentSystemBootTime { // if the device boot time is same as previous launch, mark it as a warm launch
            generateWarmLaunchData(appVisibleUptime: processStart, onNextDrawUptime: now)
        } else if currentSystemBootTime > recentLaunch.timeSinceLastBoot { // if the current device boot time is more recent than previous launch, mark it as a cold launch
            generateColdLaunchData(processStartUptime: processStart, onNextDrawUptime: now)
        } else { // This else case will only be executed in case of clock skew.
            generateColdLaunchData(processStartUptime: processStart, onNextDrawUptime: now)
        }
        userDefaultStorage.setRecentLaunchData(currentLaunchData)
    }

    private func generateHotLaunchData(appVisibleUptime: UnsignedNumber, onNextDrawUptime: UnsignedNumber) {
        let hotLaunchData = HotLaunchData(appVisibleUptime: appVisibleUptime,
                                          onNextDrawUptime: onNextDrawUptime,
                                          launchedActivity: getViewControllerName(),
                                          hasSavedState: false,
                                          intentData: nil)
        launchCallbacks.onHotLaunch(data: hotLaunchData)
    }

    private func generateColdLaunchData(processStartUptime: UnsignedNumber, onNextDrawUptime: UnsignedNumber) {
        let coldLaunchData = ColdLaunchData(processStartUptime: processStartUptime,
                                            processStartRequestedUptime: nil,
                                            contentProviderAttachUptime: nil,
                                            onNextDrawUptime: onNextDrawUptime,
                                            launchedActivity: getViewControllerName(),
                                            hasSavedState: false,
                                            intentData: nil)
        launchCallbacks.onColdLaunch(data: coldLaunchData)
    }

    private func generateWarmLaunchData(appVisibleUptime: UnsignedNumber, onNextDrawUptime: UnsignedNumber) {
        let warmLaunchData = WarmLaunchData(appVisibleUptime: appVisibleUptime,
                                            onNextDrawUptime: onNextDrawUptime,
                                            launchedActivity: getViewControllerName(),
                                            hasSavedState: false,
                                            intentData: nil)
        launchCallbacks.onWarmLaunch(data: warmLaunchData)
    }

    private func removeObserver() {
        NotificationCenter.default.removeObserver(self,
                                                  name: UIApplication.didBecomeActiveNotification,
                                                  object: nil)
        NotificationCenter.default.removeObserver(self,
                                                  name: UIApplication.willEnterForegroundNotification,
                                                  object: nil)
    }

    private func getViewControllerName() -> String {
        let keyWindow = UIWindow.keyWindow()

        if var topController = keyWindow?.rootViewController {
            while let presentedViewController = topController.presentedViewController {
                topController = presentedViewController
            }

            return NSStringFromClass(type(of: topController))
        }

        return "unknown"
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
