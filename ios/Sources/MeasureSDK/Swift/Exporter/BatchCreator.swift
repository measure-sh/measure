//
//  BatchCreator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/10/24.
//

import Foundation

protocol BatchCreator {
    func create(sessionId: String?) -> BatchCreationResult?
}

typealias BatchCreationResult = (batchId: String, eventIds: [String])

final class BaseBatchCreator: BatchCreator {
    private let logger: Logger
    private let idProvider: IdProvider
    private let configProvider: ConfigProvider
    private let timeProvider: TimeProvider
    private let eventStore: EventStore
    private let batchStore: BatchStore

    init(logger: Logger, idProvider: IdProvider, configProvider: ConfigProvider, timeProvider: TimeProvider, eventStore: EventStore, batchStore: BatchStore) {
        self.logger = logger
        self.idProvider = idProvider
        self.configProvider = configProvider
        self.timeProvider = timeProvider
        self.eventStore = eventStore
        self.batchStore = batchStore
    }

    func create(sessionId: String? = nil) -> BatchCreationResult? {
        let eventToAttachmentSizeMap = eventStore.getUnBatchedEventsWithAttachmentSize(eventCount: configProvider.maxEventsInBatch, ascending: true, sessionId: nil)

        if eventToAttachmentSizeMap.isEmpty {
            logger.log(level: .debug, message: "No events to batch", error: nil, data: nil)
            return nil
        }

        let eventIds = filterEventsForMaxAttachmentSize(eventToAttachmentSizeMap)
        if eventIds.isEmpty {
            logger.log(level: .debug, message: "No events to batch after filtering for max attachment size", error: nil, data: nil)
            return nil
        }

        let batchId = idProvider.createId()
        let isBatchInsertionSuccessful = batchStore.insertBatch(BatchEntity(batchId: batchId, eventIds: eventIds, createdAt: timeProvider.now()))

        if !isBatchInsertionSuccessful {
            logger.log(level: .error, message: "Failed to insert batched event IDs", error: nil, data: nil)
            return nil
        }

        eventStore.updateBatchId(batchId, for: eventIds)
        return BatchCreationResult(batchId: batchId, eventIds: eventIds)
    }

    /// Filters events to ensure the total size of attachments does not exceed the maximum limit.
    private func filterEventsForMaxAttachmentSize(_ eventToAttachmentSizeMap: [String: Int64]) -> [String] {
        var totalSize: Int64 = 0
        return eventToAttachmentSizeMap.prefix {
            totalSize += $0.value
            return totalSize <= configProvider.maxAttachmentSizeInEventsBatchInBytes
        }.map { $0.key }
    }
}
