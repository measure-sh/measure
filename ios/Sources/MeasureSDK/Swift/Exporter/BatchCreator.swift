//
//  BatchCreator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/10/24.
//

import Foundation

protocol BatchCreator {
    func create(sessionId: String?, completion: @escaping ((BatchCreationResult?) -> Void))
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

    func create(sessionId: String? = nil, completion: @escaping (BatchCreationResult?) -> Void) {
        eventStore.getUnBatchedEventsWithAttachmentSize(
            eventCount: configProvider.maxEventsInBatch,
            ascending: true,
            sessionId: sessionId
        ) { [weak self] eventToAttachmentSizeMap in
            guard let self else { return }

            let eventIds = filterEventsForMaxAttachmentSize(eventToAttachmentSizeMap)

            spanStore.getUnBatchedSpans(
                spanCount: configProvider.maxEventsInBatch,
                ascending: true
            ) { [weak self] spanIds in
                guard let self else { return }

                if eventIds.isEmpty && spanIds.isEmpty {
                    logger.log(level: .debug, message: "No events or spans to batch.", error: nil, data: nil)
                    completion(nil)
                    return
                }

                let batchId = idProvider.uuid()
                let batch = BatchEntity(
                    batchId: batchId,
                    eventIds: eventIds,
                    spanIds: spanIds,
                    createdAt: timeProvider.now()
                )

                batchStore.insertBatch(batch) { [weak self] isBatchInsertionSuccessful in
                    guard let self else { return }

                    if !isBatchInsertionSuccessful {
                        logger.log(level: .error, message: "Failed to insert batched event IDs", error: nil, data: nil)
                        completion(nil)
                        return
                    }

                    // Fire-and-forget updates
                    eventStore.updateBatchId(batchId, for: eventIds)
                    spanStore.updateBatchId(batchId, for: spanIds)

                    let result = BatchCreationResult(
                        batchId: batchId,
                        eventIds: eventIds,
                        spanIds: spanIds
                    )
                    completion(result)
                }
            }
        }
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
