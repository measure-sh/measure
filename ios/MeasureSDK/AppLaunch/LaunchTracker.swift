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

protocol LaunchTracker {
    func start()
    func stop()
}

final class BaseLaunchTracker: LaunchTracker {
    private let launchCallbacks: LaunchCallbacks
    private let timeProvider: TimeProvider
    private let sysCtl: SysCtl
    private let logger: Logger
    private var willEnterForegroundTimestamp: UnsignedNumber?
    private var isLaunching: Bool
    private let userDefaultStorage: UserDefaultStorage
    private let currentAppVersion: String

    init(launchCallbacks: LaunchCallbacks, timeProvider: TimeProvider, sysCtl: SysCtl, logger: Logger, userDefaultStorage: UserDefaultStorage, currentAppVersion: String) {
        self.launchCallbacks = launchCallbacks
        self.timeProvider = timeProvider
        self.sysCtl = sysCtl
        self.logger = logger
        self.isLaunching = true
        self.userDefaultStorage = userDefaultStorage
        self.currentAppVersion = currentAppVersion
    }

    func start() {
        NotificationCenter.default.addObserver(self,
                                               selector: #selector(onDidBecomeActive),
                                               name: UIApplication.didBecomeActiveNotification,
                                               object: nil)
        NotificationCenter.default.addObserver(self,
                                               selector: #selector(onWillEnterForeground),
                                               name: UIApplication.willEnterForegroundNotification,
                                               object: nil)
    }

    func stop() {
        removeObserver()
    }

    @objc private func onDidBecomeActive(_ notification: Notification) {
        if isLaunching {
            isLaunching = false
            processAppLaunchData()
        } else if let willEnterForegroundTimestamp = self.willEnterForegroundTimestamp {
            generateHotLaunchData(appVisibleUptime: willEnterForegroundTimestamp, onNextDrawUptime: UnsignedNumber(timeProvider.millisTime))
        }
    }

    @objc private func onWillEnterForeground(_ notification: Notification) {
        willEnterForegroundTimestamp = UnsignedNumber(timeProvider.millisTime)
    }

    private func processAppLaunchData() {
        guard let processStart = sysCtl.getProcessStartTime(),
              let currentSystemBootTime = sysCtl.getSystemBootTime() else {
            logger.log(level: .error, message: "Could not get process start time.", error: nil, data: nil)
            return
        }

        let currentLaunchData = LaunchData(appVersion: currentAppVersion, timeSinceLastBoot: currentSystemBootTime)
        // Mark a launch as cold launch if recent launch data is not available
        guard let recentLaunch = userDefaultStorage.getRecentLaunchData() else {
            generateColdLaunchData(processStartUptime: processStart * 1_000, onNextDrawUptime: UnsignedNumber(Date().timeIntervalSince1970 * 1_000))
            userDefaultStorage.setRecentLaunchData(currentLaunchData)
            return
        }

        if recentLaunch.appVersion != currentAppVersion { // if app is updated, mark it as a cold launch
            generateColdLaunchData(processStartUptime: processStart * 1_000, onNextDrawUptime: UnsignedNumber(Date().timeIntervalSince1970 * 1_000))
        } else if recentLaunch.timeSinceLastBoot == currentSystemBootTime { // if the device boot time is same as previous launch, mark it as a warm launch
            generateWarmLaunchData(appVisibleUptime: processStart * 1_000, onNextDrawUptime: UnsignedNumber(Date().timeIntervalSince1970 * 1_000))
        } else if currentSystemBootTime > recentLaunch.timeSinceLastBoot { // if the current device boot time is more recent than previous launch, mark it as a cold launch
            generateColdLaunchData(processStartUptime: processStart * 1_000, onNextDrawUptime: UnsignedNumber(Date().timeIntervalSince1970 * 1_000))
        } else { // This else case will only be executed in case of clock skew.
            generateColdLaunchData(processStartUptime: processStart * 1_000, onNextDrawUptime: UnsignedNumber(Date().timeIntervalSince1970 * 1_000))
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
        guard let viewController = getActiveViewController() else {
            return ""
        }

        return NSStringFromClass(type(of: viewController))
    }

    private func getActiveViewController(_ rootViewController: UIViewController? = UIApplication.shared.keyWindow?.rootViewController) -> UIViewController? {
        if let navigationController = rootViewController as? UINavigationController {
            return getActiveViewController(navigationController.visibleViewController)
        } else if let tabBarController = rootViewController as? UITabBarController {
            return getActiveViewController(tabBarController.selectedViewController)
        } else if let presentedViewController = rootViewController?.presentedViewController {
            return getActiveViewController(presentedViewController)
        } else {
            return rootViewController
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}
