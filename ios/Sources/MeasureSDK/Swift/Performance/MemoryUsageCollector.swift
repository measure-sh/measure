//
//  MemoryUsageCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 07/11/24.
//

import Foundation

protocol MemoryUsageCollector {
    func enable()
    func disable()
    func resume()
    func pause()
    func onConfigLoaded()
}

final class BaseMemoryUsageCollector: MemoryUsageCollector {
    private var timer: Timer?
    private let logger: Logger
    private let configProvider: ConfigProvider
    private let sysCtl: SysCtl
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private let memoryUsageCalculator: MemoryUsageCalculator
    private var isTrackingInProgress = false
    private let isEnabled = AtomicBool(false)

    init(logger: Logger,
         configProvider: ConfigProvider,
         signalProcessor: SignalProcessor,
         timeProvider: TimeProvider,
         memoryUsageCalculator: MemoryUsageCalculator,
         sysCtl: SysCtl) {
        self.logger = logger
        self.configProvider = configProvider
        self.signalProcessor = signalProcessor
        self.sysCtl = sysCtl
        self.timeProvider = timeProvider
        self.memoryUsageCalculator = memoryUsageCalculator
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            guard timer == nil else { return }
            register()
            logger.log(level: .info, message: "MemoryUsageCollector enabled.", error: nil, data: nil)
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            unregister()
            logger.log(level: .info, message: "MemoryUsageCollector disabled.", error: nil, data: nil)
        }
    }

    func resume() {
        guard isEnabled.get(), timer == nil else { return }
        register()
        logger.log(level: .info, message: "MemoryUsageCollector resumed.", error: nil, data: nil)
    }

    func pause() {
        guard timer != nil else { return }
        unregister()
        logger.log(level: .info, message: "MemoryUsageCollector paused.", error: nil, data: nil)
    }

    func onConfigLoaded() {
        guard timer != nil else { return }
        unregister()
        register()
    }

    private func register() {
        guard timer == nil else { return }

        let intervalSeconds = TimeInterval(configProvider.memoryUsageInterval)

        timer = Timer.scheduledTimer(withTimeInterval: intervalSeconds,
                                     repeats: true) { [weak self] _ in
            guard let self else { return }
            self.trackMemoryUsage()
        }
    }

    private func unregister() {
        timer?.invalidate()
        timer = nil
    }

    func trackMemoryUsage() {
        guard !isTrackingInProgress else { return }
        isTrackingInProgress = true
        defer { isTrackingInProgress = false }

        guard let usedMemory = memoryUsageCalculator.getCurrentMemoryUsage() else {
            logger.internalLog(level: .error, message: "Could not get memory usage data.", error: nil, data: nil)
            return
        }

        let intervalMs: UnsignedNumber = UnsignedNumber(configProvider.memoryUsageInterval * 1000)
        let data = MemoryUsageData(maxMemory: sysCtl.getMaximumAvailableRam(),
                                   usedMemory: usedMemory,
                                   interval: intervalMs)
        signalProcessor.track(data: data,
                              timestamp: timeProvider.now(),
                              type: .memoryUsageAbsolute,
                              attributes: nil,
                              sessionId: nil,
                              attachments: nil,
                              userDefinedAttributes: nil,
                              threadName: nil,
                              needsReporting: false)
    }
}
