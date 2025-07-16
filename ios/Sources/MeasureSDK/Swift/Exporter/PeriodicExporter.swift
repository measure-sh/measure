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
        exporter.getExistingBatches { [weak self] batches in
            guard let self else { return }
            if !batches.isEmpty {
                self.processExistingBatches(batches)
            } else {
                self.processNewBatchIfTimeElapsed()
            }
        }
    }

    private func processExistingBatches(_ batches: [BatchEntity]) {
        func processNext(index: Int) {
            guard index < batches.count else { return } // Done with all batches

            let batch = batches[index]

            exporter.export(batchId: batch.batchId, eventIds: batch.eventIds, spanIds: batch.spanIds) { [weak self] response in
                guard let self else { return }

                switch response {
                case .success:
                    logger.internalLog(level: .info, message: "Batch \(batch.batchId) sent successfully.", error: nil, data: nil)
                    processNext(index: index + 1) // Process next batch
                case .error(let error):
                    switch error {
                    case .rateLimitError:
                        logger.internalLog(level: .error, message: "Rate limit hit. Stopping further batch processing.", error: nil, data: nil)
                        return // Stop processing
                    case .serverError:
                        logger.internalLog(level: .error, message: "Internal server error. Stopping further batch processing.", error: nil, data: nil)
                        return // Stop processing
                    default:
                        logger.internalLog(level: .error, message: "Batch \(batch.batchId) request failed.", error: nil, data: nil)
                        processNext(index: index + 1) // Continue on other errors
                    }
                case .none:
                    processNext(index: index + 1) // Safely continue
                }
            }
        }

        processNext(index: 0) // Start processing
    }

    private func processNewBatchIfTimeElapsed() {
        let currentTime = timeProvider.millisTime

        if currentTime - lastBatchCreationUptimeMs >= configProvider.eventsBatchingIntervalMs {
            exporter.createBatch(nil) { [weak self] result in
                guard let self = self, let result = result else { return }

                self.lastBatchCreationUptimeMs = currentTime

                self.processExistingBatches([
                    BatchEntity(batchId: result.batchId,
                                eventIds: result.eventIds,
                                spanIds: result.spanIds,
                                createdAt: currentTime)
                ])
            }
        } else {
            logger.log(level: .debug, message: "Skipping batch creation as interval hasn't elapsed", error: nil, data: nil)
        }
    }
}
