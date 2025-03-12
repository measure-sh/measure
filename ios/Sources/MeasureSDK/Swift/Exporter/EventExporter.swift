//
//  EventExporter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/10/24.
//

import Foundation

protocol EventExporter {
    func createBatch(_ sessionId: String?) -> BatchCreationResult?
    func getExistingBatches() -> [BatchEntity]
    func export(batchId: String, eventIds: [String]) -> HttpResponse?
}

final class BaseEventExporter: EventExporter {
    private let logger: Logger
    private let networkClient: NetworkClient
    private let batchCreator: BatchCreator
    private let batchStore: BatchStore
    private let eventStore: EventStore

    private let maxExistingBatchesToExport = 5
    private var batchIdsInTransit = Set<String>()

    init(logger: Logger, networkClient: NetworkClient, batchCreator: BatchCreator, batchStore: BatchStore, eventStore: EventStore) {
        self.logger = logger
        self.networkClient = networkClient
        self.batchCreator = batchCreator
        self.batchStore = batchStore
        self.eventStore = eventStore
    }

    func createBatch(_ sessionId: String?) -> BatchCreationResult? {
        return batchCreator.create(sessionId: sessionId)
    }

    func getExistingBatches() -> [BatchEntity] {
        return batchStore.getBatches(maxExistingBatchesToExport)
    }

    func export(batchId: String, eventIds: [String]) -> HttpResponse? {
        guard !batchIdsInTransit.contains(batchId) else {
            logger.internalLog(level: .warning, message: "Batch \(batchId) is already in transit, skipping export", error: nil, data: nil)
            return nil
        }

        batchIdsInTransit.insert(batchId)
        defer { batchIdsInTransit.remove(batchId) }

        guard let events = eventStore.getEvents(eventIds: eventIds), !events.isEmpty else {
            logger.internalLog(level: .error, message: "No events found for batch \(batchId), invalid export request", error: nil, data: nil)
            return nil
        }

        let response = networkClient.execute(batchId: batchId, events: events)

        handleBatchProcessingResult(response: response, batchId: batchId, events: events)
        return response
    }

    private func handleBatchProcessingResult(response: HttpResponse, batchId: String, events: [EventEntity]) {
        switch response {
        case .success:
            deleteEvents(batchId: batchId, events: events)
            logger.internalLog(level: .debug, message: "Successfully sent batch \(batchId)", error: nil, data: nil)
        case .error(let errorType):
            switch errorType {
                case .clientError(_, _): // swiftlint:disable:this empty_enum_arguments
                deleteEvents(batchId: batchId, events: events)
                logger.internalLog(level: .error, message: "Client error while sending batch \(batchId), dropping the batch", error: nil, data: nil)
                default:
                    break
                }
        }
    }

    private func deleteEvents(batchId: String, events: [EventEntity]) {
        let eventIds = events.map { $0.id }
        eventStore.deleteEvents(eventIds: eventIds)
        batchStore.deleteBatch(batchId)
    }
}
