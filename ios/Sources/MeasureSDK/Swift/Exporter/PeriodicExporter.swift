//
//  PeriodicExporter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/10/24.
//

import Foundation

protocol PeriodicExporter {
    func applicationDidEnterBackground()
    func applicationWillEnterForeground()
    func enable()
    func disable()
}

final class BasePeriodicExporter: PeriodicExporter, HeartbeatListener {
    private let logger: Logger
    private let configProvider: ConfigProvider
    private let timeProvider: TimeProvider
    private let heartbeat: Heartbeat
    private let exporter: Exporter
    private let dispatchQueue: DispatchQueue
    private let isEnabled = AtomicBool(false)

    var isExportInProgress: Bool = false
    var lastBatchCreationUptimeMs: Int64 = 0

    init(logger: Logger, configProvider: ConfigProvider, timeProvider: TimeProvider, heartbeat: Heartbeat, exporter: Exporter, dispatchQueue: DispatchQueue) {
        self.logger = logger
        self.configProvider = configProvider
        self.timeProvider = timeProvider
        self.heartbeat = heartbeat
        self.exporter = exporter
        self.dispatchQueue = dispatchQueue
        self.heartbeat.addListener(self)
    }

    func pulse() {
        exportEvents()
    }

    func applicationWillEnterForeground() {
        if isEnabled.get() {
            enable()
        }
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            heartbeat.start(intervalMs: configProvider.eventsBatchingIntervalMs, initialDelayMs: 0)
            logger.log(level: .info, message: "PeriodicEventExporter enabled.", error: nil, data: nil)
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            heartbeat.stop()
            logger.log(level: .info, message: "PeriodicEventExporter disabled.", error: nil, data: nil)
        }
    }

    func applicationDidEnterBackground() {
        disable()
    }

    private func exportEvents() {
        guard !isExportInProgress else {
            logger.log(level: .debug, message: "Skipping export operation as another operation is in progress", error: nil, data: nil)
            return
        }

        isExportInProgress = true
        defer { isExportInProgress = false }

        dispatchQueue.sync {
            processBatches()
        }
    }

    private func processBatches() {
        let batches = exporter.getExistingBatches()
        if !batches.isEmpty {
            processExistingBatches(batches)
        } else {
            processNewBatchIfTimeElapsed()
        }
    }

    private func processExistingBatches(_ batches: [BatchEntity]) {
        for batch in batches {
            let response = exporter.export(batchId: batch.batchId, eventIds: batch.eventIds, spanIds: batch.spanIds)

            switch response {
            case .success:
                logger.internalLog(level: .info, message: "Batch \(batch.batchId) sent successfully.", error: nil, data: nil)
            case .error(let error):
                switch error {
                case .rateLimitError:
                    // Stop processing the rest of the batches if we encounter a rate limit
                    logger.internalLog(level: .error, message: "Rate limit hit.", error: nil, data: nil)
                    return
                case .serverError:
                    // Stop processing the rest of the batches if we encounter a server error
                    logger.internalLog(level: .error, message: "Internal server error.", error: nil, data: nil)
                    return
                default:
                    logger.internalLog(level: .error, message: "Batch \(batch.batchId) request failed.", error: nil, data: nil)
                }
            case .none:
                break
            }
        }
    }

    private func processNewBatchIfTimeElapsed() {
        if timeProvider.millisTime - lastBatchCreationUptimeMs >= configProvider.eventsBatchingIntervalMs {
            if let result = exporter.createBatch(nil) {
                lastBatchCreationUptimeMs = timeProvider.millisTime
                processExistingBatches([BatchEntity(batchId: result.batchId,
                                                    eventIds: result.eventIds,
                                                    spanIds: result.spanIds,
                                                    createdAt: lastBatchCreationUptimeMs)])
            }
        } else {
            logger.log(level: .debug, message: "Skipping batch creation as interval hasn't elapsed", error: nil, data: nil)
        }
    }
}
