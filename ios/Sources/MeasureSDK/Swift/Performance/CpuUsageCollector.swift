//
//  CpuUsageCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 04/11/24.
//

import Foundation

protocol CpuUsageCollector {
    func enable()
    func resume()
    func pause()
}

final class BaseCpuUsageCollector: CpuUsageCollector {
    private var timer: Timer?
    private let logger: Logger
    private let configProvider: ConfigProvider
    private let eventProcessor: EventProcessor
    private let timeProvider: TimeProvider
    private let cpuUsageCalculator: CpuUsageCalculator
    private let sysCtl: SysCtl
    private var isTrackingInProgress = false
    private var isEnabled = false

    init(logger: Logger, configProvider: ConfigProvider, eventProcessor: EventProcessor, timeProvider: TimeProvider, cpuUsageCalculator: CpuUsageCalculator, sysCtl: SysCtl) {
        self.logger = logger
        self.configProvider = configProvider
        self.eventProcessor = eventProcessor
        self.timeProvider = timeProvider
        self.cpuUsageCalculator = cpuUsageCalculator
        self.sysCtl = sysCtl
    }

    func enable() {
        guard timer == nil else { return }

        isEnabled = true
        initializeTimer()
        logger.log(level: .info, message: "CpuUsageCollector enabled.", error: nil, data: nil)
    }

    func resume() {
        if isEnabled && timer == nil {
            initializeTimer()
            logger.log(level: .info, message: "CpuUsageCollector resumed.", error: nil, data: nil)
        }
    }

    func pause() {
        guard let timer = self.timer else { return }
        logger.log(level: .info, message: "CpuUsageCollector paused.", error: nil, data: nil)
        timer.invalidate()
        self.timer = nil
    }

    private func initializeTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: Double(configProvider.cpuTrackingIntervalMs) / 1000.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.trackCpuUsage()
        }
    }

    func trackCpuUsage() {
        guard !isTrackingInProgress else { return }
        isTrackingInProgress = true
        defer { isTrackingInProgress = false }

        let cpuUsageData = self.cpuUsageCalculator.getCurrentCpuUsage()

        if cpuUsageData != -1 {
            let cpuUsageData = CpuUsageData(numCores: sysCtl.getCpuCores(),
                                            clockSpeed: sysCtl.getCpuFrequency(),
                                            startTime: 0,
                                            uptime: 0,
                                            utime: 0,
                                            cutime: 0,
                                            cstime: 0,
                                            stime: 0,
                                            interval: configProvider.cpuTrackingIntervalMs,
                                            percentageUsage: FloatNumber64(cpuUsageData))

            eventProcessor.track(data: cpuUsageData,
                                 timestamp: timeProvider.now(),
                                 type: .cpuUsage,
                                 attributes: nil,
                                 sessionId: nil,
                                 attachments: nil,
                                 userDefinedAttributes: nil)
        } else {
            logger.internalLog(level: .error, message: "Could not get CPU usage data.", error: nil, data: nil)
        }
    }
}
