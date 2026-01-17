//
//  CpuUsageCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 04/11/24.
//

import Foundation

protocol CpuUsageCollector {
    func enable()
    func disable()
    func resume()
    func pause()
    func onConfigLoaded()
}

final class BaseCpuUsageCollector: CpuUsageCollector {
    private var timer: Timer?
    private let logger: Logger
    private let configProvider: ConfigProvider
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private let cpuUsageCalculator: CpuUsageCalculator
    private let sysCtl: SysCtl
    private var isTrackingInProgress = false
    private var isEnabled = AtomicBool(false)

    init(logger: Logger, configProvider: ConfigProvider, signalProcessor: SignalProcessor, timeProvider: TimeProvider, cpuUsageCalculator: CpuUsageCalculator, sysCtl: SysCtl) {
        self.logger = logger
        self.configProvider = configProvider
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.cpuUsageCalculator = cpuUsageCalculator
        self.sysCtl = sysCtl
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            guard timer == nil else { return }

            initializeTimer()
            logger.log(level: .info, message: "CpuUsageCollector enabled.", error: nil, data: nil)
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            stopTimer()

            self.timer?.invalidate()
            self.timer = nil
            logger.log(level: .info, message: "CpuUsageCollector disabled.", error: nil, data: nil)
        }
    }

    func resume() {
        guard isEnabled.get(), timer == nil else { return }

        initializeTimer()
        logger.log(level: .info, message: "CpuUsageCollector resumed.", error: nil, data: nil)
    }

    func pause() {
        guard timer != nil else { return }

        stopTimer()
        logger.log(level: .info, message: "CpuUsageCollector paused.", error: nil, data: nil)
    }

    func onConfigLoaded() {
        guard isEnabled.get(), timer != nil else { return }

        logger.log(level: .info, message: "CpuUsageCollector config updated, restarting timer.", error: nil, data: nil)

        stopTimer()
        initializeTimer()
    }

    private func initializeTimer() {
        let intervalSeconds = TimeInterval(configProvider.cpuUsageInterval)

        timer = Timer.scheduledTimer(withTimeInterval: intervalSeconds,
                                     repeats: true) { [weak self] _ in
            guard let self else { return }
            self.trackCpuUsage()
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    func trackCpuUsage() {
        guard !isTrackingInProgress else { return }
        isTrackingInProgress = true
        defer { isTrackingInProgress = false }

        let usage = cpuUsageCalculator.getCurrentCpuUsage()
        guard usage >= 0 else {
            logger.internalLog(level: .error, message: "Could not get CPU usage data.", error: nil, data: nil)
            return
        }

        let intervalMs = configProvider.cpuUsageInterval * 1000

        let data = CpuUsageData(numCores: sysCtl.getCpuCores(),
                                clockSpeed: sysCtl.getCpuFrequency(),
                                startTime: 0,
                                uptime: 0,
                                utime: 0,
                                cutime: 0,
                                cstime: 0,
                                stime: 0,
                                interval: UnsignedNumber(intervalMs),
                                percentageUsage: FloatNumber64(usage))
        // TODO: update needsReporting flag using sampler
        signalProcessor.track(data: data,
                              timestamp: timeProvider.now(),
                              type: .cpuUsage,
                              attributes: nil,
                              sessionId: nil,
                              attachments: nil,
                              userDefinedAttributes: nil,
                              threadName: nil,
                              needsReporting: false)
    }
}
