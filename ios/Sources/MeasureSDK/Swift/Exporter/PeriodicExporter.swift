//
//  PeriodicExporter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 10/11/26.
//

import Foundation

/// Exports data at a fixed interval. Used only in debug builds.
protocol PeriodicExporter {
    func start()
    func stop()
    func setInForeground(_ isInForeground: Bool)
}

final class BasePeriodicExporter: PeriodicExporter {
    private let logger: Logger
    private let configProvider: ConfigProvider
    private let exporter: Exporter
    private let dispatchQueue: DispatchQueue
    private var timer: DispatchSourceTimer?
    private var isStarted = false
    private var isInForeground = true

    init(logger: Logger, configProvider: ConfigProvider, exporter: Exporter, dispatchQueue: DispatchQueue) {
        self.logger = logger
        self.configProvider = configProvider
        self.exporter = exporter
        self.dispatchQueue = dispatchQueue
    }

    func start() {
        dispatchQueue.async { [weak self] in
            self?.isStarted = true
            self?.updateTimer()
        }
    }

    func stop() {
        dispatchQueue.async { [weak self] in
            self?.isStarted = false
            self?.updateTimer()
        }
    }

    func setInForeground(_ isInForeground: Bool) {
        dispatchQueue.async { [weak self] in
            self?.isInForeground = isInForeground
            self?.updateTimer()
        }
    }

    private func updateTimer() {
        let shouldRun = isStarted && isInForeground
        if shouldRun && timer == nil {
            let intervalMs = Int(configProvider.debugExportIntervalMs)
            let timer = DispatchSource.makeTimerSource(queue: dispatchQueue)
            timer.schedule(deadline: .now() + .milliseconds(intervalMs), repeating: .milliseconds(intervalMs))
            timer.setEventHandler { [weak self] in
                self?.exporter.export()
            }
            timer.resume()
            self.timer = timer
            logger.internalLog(level: .debug, message: "PeriodicExporter: started with interval \(intervalMs)ms", error: nil, data: nil)
        } else if !shouldRun, let timer {
            timer.cancel()
            self.timer = nil
            logger.internalLog(level: .debug, message: "PeriodicExporter: stopped", error: nil, data: nil)
        }
    }
}
