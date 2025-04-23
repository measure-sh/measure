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
    private var isEnabled = AtomicBool(false)

    init(logger: Logger, configProvider: ConfigProvider, signalProcessor: SignalProcessor, timeProvider: TimeProvider, memoryUsageCalculator: MemoryUsageCalculator, sysCtl: SysCtl) {
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

            initializeTimer()
            logger.log(level: .info, message: "MemoryUsageCollector enabled.", error: nil, data: nil)
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            guard let timer = self.timer else { return }

            timer.invalidate()
            self.timer = nil
            logger.log(level: .info, message: "MemoryUsageCollector disabled.", error: nil, data: nil)
        }
    }

    func resume() {
        if isEnabled.get() && timer == nil {
            initializeTimer()
            logger.log(level: .info, message: "MemoryUsageCollector resumed.", error: nil, data: nil)
        }
    }

    func pause() {
        guard let timer = self.timer else { return }
        logger.log(level: .info, message: "MemoryUsageCollector paused.", error: nil, data: nil)
        timer.invalidate()
        self.timer = nil
    }

    private func initializeTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: Double(configProvider.memoryTrackingIntervalMs) / 1000.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.trackMemoryUsage()
        }
    }

    func trackMemoryUsage() {
        guard !isTrackingInProgress else { return }
        isTrackingInProgress = true
        defer { isTrackingInProgress = false }

        if let memoryUsage = self.memoryUsageCalculator.getCurrentMemoryUsage() {
            let memoryUsageData = MemoryUsageData(maxMemory: sysCtl.getMaximumAvailableRam(),
                                                  usedMemory: memoryUsage,
                                                  interval: configProvider.memoryTrackingIntervalMs)

            self.signalProcessor.track(data: memoryUsageData,
                                       timestamp: timeProvider.now(),
                                       type: .memoryUsageAbsolute,
                                       attributes: nil,
                                       sessionId: nil,
                                       attachments: nil,
                                       userDefinedAttributes: nil)
        } else {
            logger.internalLog(level: .error, message: "Could not get memory usage data.", error: nil, data: nil)
        }
    }
}
