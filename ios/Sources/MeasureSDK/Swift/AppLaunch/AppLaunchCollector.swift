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
    func onConfigLoaded()
}

final class BaseAppLaunchCollector: AppLaunchCollector {
    private let logger: Logger
    private let timeProvider: TimeProvider
    private let signalProcessor: SignalProcessor
    private let launchTracker: LaunchTracker
    private let launchCallback: LaunchCallbacks
    private var enabled = false
    private let sampler: SignalSampler
    private let bufferLock = NSLock()
    private var trackEventBuffer: [() -> Void]? = []
    private var needsReporting: Bool?

    init(logger: Logger,
         timeProvider: TimeProvider,
         signalProcessor: SignalProcessor,
         sysCtl: SysCtl,
         userDefaultStorage: UserDefaultStorage,
         sampler: SignalSampler,
         launchTracker: LaunchTracker,
         launchCallback: LaunchCallbacks) {
        self.logger = logger
        self.timeProvider = timeProvider
        self.signalProcessor = signalProcessor
        self.launchCallback = launchCallback
        self.sampler = sampler
        self.launchTracker = launchTracker

        self.launchCallback.onColdLaunchCallback = onColdLaunchCallback(_:)
        self.launchCallback.onWarmLaunchCallback = onWarmLaunchCallback(_:)
        self.launchCallback.onHotLaunchCallback = onHotLaunchCallback(_:)
    }

    func enable() {
        enabled = true
        logger.log(level: .info, message: "AppLaunchCollector enabled.", error: nil, data: nil)
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

    func onConfigLoaded() {
        bufferLock.lock()
        let pending = trackEventBuffer
        trackEventBuffer = nil
        bufferLock.unlock()

        guard let pending, !pending.isEmpty else { return }

        logger.log(level: .debug, message: "AppLaunchCollector: flushing \(pending.count) buffered launch events", error: nil, data: nil)

        pending.forEach { $0() }
    }

    private func onColdLaunchCallback(_ data: ColdLaunchData) {
        guard enabled else { return }

        let timestamp = timeProvider.now()
        trackOrBuffer {
            self.signalProcessor.track(data: data,
                                       timestamp: timestamp,
                                       type: .coldLaunch,
                                       attributes: nil,
                                       sessionId: nil,
                                       attachments: nil,
                                       userDefinedAttributes: nil,
                                       threadName: nil,
                                       needsReporting: self.sampler.shouldTrackLaunchEvents())
        }
    }

    private func onWarmLaunchCallback(_ data: WarmLaunchData) {
        guard enabled else { return }

        let timestamp = timeProvider.now()
        trackOrBuffer {
            self.signalProcessor.track(
                data: data,
                timestamp: timestamp,
                type: .warmLaunch,
                attributes: nil,
                sessionId: nil,
                attachments: nil,
                userDefinedAttributes: nil,
                threadName: nil,
                needsReporting: self.sampler.shouldTrackLaunchEvents()
            )
        }
    }

    private func onHotLaunchCallback(_ data: HotLaunchData) {
        guard enabled else { return }

        let timestamp = timeProvider.now()
        trackOrBuffer {
            self.signalProcessor.track(data: data,
                                       timestamp: timestamp,
                                       type: .hotLaunch,
                                       attributes: nil,
                                       sessionId: nil,
                                       attachments: nil,
                                       userDefinedAttributes: nil,
                                       threadName: nil,
                                       needsReporting: self.sampler.shouldTrackLaunchEvents())
        }
    }

    private func trackOrBuffer(_ action: @escaping () -> Void) {
        bufferLock.lock()
        if var buffer = trackEventBuffer {
            buffer.append(action)
            trackEventBuffer = buffer
            bufferLock.unlock()

            logger.log(level: .debug, message: "AppLaunchCollector: buffering launch event until config is loaded", error: nil, data: nil)
        } else {
            bufferLock.unlock()
            action()
        }
    }
}
