//
//  AppLaunchCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 12/11/24.
//

import Foundation

protocol AppLaunchCollector {
    func enable()
    func applicationWillEnterForeground()
    func applicationDidBecomeActive()
    func applicationWillResignActive()
}

final class BaseAppLaunchCollector: AppLaunchCollector {
    private let logger: Logger
    private let timeProvider: TimeProvider
    private let signalProcessor: SignalProcessor
    private let launchTracker: LaunchTracker
    private let launchCallback: LaunchCallbacks
    private var enabled = false

    init(logger: Logger,
         timeProvider: TimeProvider,
         signalProcessor: SignalProcessor,
         sysCtl: SysCtl,
         userDefaultStorage: UserDefaultStorage,
         currentAppVersion: String) {
        self.logger = logger
        self.timeProvider = timeProvider
        self.signalProcessor = signalProcessor
        self.launchCallback = LaunchCallbacks()
        self.launchTracker = BaseLaunchTracker(launchCallbacks: launchCallback,
                                               timeProvider: timeProvider,
                                               sysCtl: sysCtl,
                                               logger: logger,
                                               userDefaultStorage: userDefaultStorage,
                                               currentAppVersion: currentAppVersion)
        self.launchCallback.onColdLaunchCallback = onColdLaunchCallback(_:)
        self.launchCallback.onWarmLaunchCallback = onWarmLaunchCallback(_:)
        self.launchCallback.onHotLaunchCallback = onHotLaunchCallback(_:)
    }

    func enable() {
        logger.log(level: .info, message: "AppLaunchCollector enabled.", error: nil, data: nil)
        enabled = true
    }

    func applicationWillEnterForeground() {
        launchTracker.applicationWillEnterForeground()
    }

    func applicationDidBecomeActive() {
        launchTracker.applicationDidBecomeActive()
    }

    func applicationWillResignActive() {
        launchTracker.applicationWillResignActive()
    }

    func onColdLaunchCallback(_ data: ColdLaunchData) {
        guard enabled else { return }

        signalProcessor.track(data: data,
                              timestamp: timeProvider.now(),
                              type: .coldLaunch,
                              attributes: nil,
                              sessionId: nil,
                              attachments: nil,
                              userDefinedAttributes: nil,
                              threadName: nil)

    }

    func onWarmLaunchCallback(_ data: WarmLaunchData) {
        guard enabled else { return }

        signalProcessor.track(data: data,
                              timestamp: timeProvider.now(),
                              type: .warmLaunch,
                              attributes: nil,
                              sessionId: nil,
                              attachments: nil,
                              userDefinedAttributes: nil,
                              threadName: nil)
    }

    func onHotLaunchCallback(_ data: HotLaunchData) {
        guard enabled else { return }

        signalProcessor.track(data: data,
                              timestamp: timeProvider.now(),
                              type: .hotLaunch,
                              attributes: nil,
                              sessionId: nil,
                              attachments: nil,
                              userDefinedAttributes: nil,
                              threadName: nil)
    }
}
