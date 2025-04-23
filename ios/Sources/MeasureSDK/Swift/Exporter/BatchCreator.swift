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

typealias BatchCreationResult = (batchId: String, eventIds: [String], spanIds: [String])

final class BaseBatchCreator: BatchCreator {
    private let logger: Logger
    private let idProvider: IdProvider
    private let configProvider: ConfigProvider
    private let timeProvider: TimeProvider
    private let eventStore: EventStore
    private let batchStore: BatchStore
    private let spanStore: SpanStore

    init(logger: Logger, idProvider: IdProvider, configProvider: ConfigProvider, timeProvider: TimeProvider, eventStore: EventStore, batchStore: BatchStore, spanStore: SpanStore) {
        self.logger = logger
        self.idProvider = idProvider
        self.configProvider = configProvider
        self.timeProvider = timeProvider
        self.eventStore = eventStore
        self.batchStore = batchStore
        self.spanStore = spanStore
    }

    func create(sessionId: String? = nil) -> BatchCreationResult? {
        let eventToAttachmentSizeMap = eventStore.getUnBatchedEventsWithAttachmentSize(eventCount: configProvider.maxEventsInBatch, ascending: true, sessionId: nil)

        if eventToAttachmentSizeMap.isEmpty {
            logger.log(level: .debug, message: "No events to batch", error: nil, data: nil)
            return nil
        }

        let eventIds = filterEventsForMaxAttachmentSize(eventToAttachmentSizeMap)
        let spanIds = spanStore.getUnBatchedSpans(spanCount: configProvider.maxEventsInBatch, ascending: true)

        if eventIds.isEmpty && spanIds.isEmpty {
            logger.log(level: .debug, message: "No events or spans to batch.", error: nil, data: nil)
            return nil
        }

        let batchId = idProvider.uuid()
        let batch = BatchEntity(batchId: batchId, eventIds: eventIds, spanIds: spanIds, createdAt: timeProvider.now())
        let isBatchInsertionSuccessful = batchStore.insertBatch(batch)

        if !isBatchInsertionSuccessful {
            logger.log(level: .error, message: "Failed to insert batched event IDs", error: nil, data: nil)
            return nil
        }

        eventStore.updateBatchId(batchId, for: eventIds)
        spanStore.updateBatchId(batchId, for: spanIds)
        return BatchCreationResult(batchId: batchId, eventIds: eventIds, spanIds: spanIds)
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
