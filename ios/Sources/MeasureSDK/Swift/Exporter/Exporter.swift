//
//  Exporter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/10/24.
//

import Foundation

protocol Exporter {
    func createBatch(_ sessionId: String?, completion: @escaping (BatchCreationResult?) -> Void)
    func getExistingBatches(completion: @escaping ([BatchEntity]) -> Void)
    func export(batchId: String, eventIds: [String], spanIds: [String], completion: @escaping (HttpResponse?) -> Void)
}

final class BaseExporter: Exporter {
    private let logger: Logger
    private let networkClient: NetworkClient
    private let batchCreator: BatchCreator
    private let batchStore: BatchStore
    private let eventStore: EventStore
    private let spanStore: SpanStore

    private let maxExistingBatchesToExport = 5
    private var batchIdsInTransit = Set<String>()

    init(logger: Logger, networkClient: NetworkClient, batchCreator: BatchCreator, batchStore: BatchStore, eventStore: EventStore, spanStore: SpanStore) {
        self.logger = logger
        self.networkClient = networkClient
        self.batchCreator = batchCreator
        self.batchStore = batchStore
        self.eventStore = eventStore
        self.spanStore = spanStore
    }

    func createBatch(_ sessionId: String?, completion: @escaping (BatchCreationResult?) -> Void) {
        batchCreator.create(sessionId: sessionId, completion: completion)
    }

    func getExistingBatches(completion: @escaping ([BatchEntity]) -> Void) {
        batchStore.getBatches(maxExistingBatchesToExport, completion: completion)
    }

    func export(batchId: String, eventIds: [String], spanIds: [String], completion: @escaping (HttpResponse?) -> Void) {
        guard !batchIdsInTransit.contains(batchId) else {
            logger.internalLog(level: .warning, message: "Batch \(batchId) is already in transit, skipping export", error: nil, data: nil)
            completion(nil)
            return
        }

        batchIdsInTransit.insert(batchId)

        eventStore.getEvents(eventIds: eventIds) { [weak self] events in
            guard let self = self, let events = events else {
                self?.batchIdsInTransit.remove(batchId)
                completion(nil)
                return
            }

            self.spanStore.getSpans(spanIds: spanIds) { [weak self] spans in
                guard let self = self else {
                    self?.batchIdsInTransit.remove(batchId)
                    completion(nil)
                    return
                }

                guard let spans = spans else {
                    logger.internalLog(level: .error, message: "Failed to fetch spans for batch \(batchId).", error: nil, data: nil)
                    self.batchIdsInTransit.remove(batchId)
                    completion(nil)
                    return
                }

                guard !spans.isEmpty || !events.isEmpty else {
                    logger.internalLog(level: .error, message: "No events and spans found for batch \(batchId), invalid export request.", error: nil, data: nil)
                    self.batchStore.deleteBatch(batchId)
                    self.batchIdsInTransit.remove(batchId)
                    completion(nil)
                    return
                }

                let response = self.networkClient.execute(batchId: batchId, events: events, spans: spans)

                self.handleBatchProcessingResult(response: response, batchId: batchId, events: events, spans: spans)
                self.batchIdsInTransit.remove(batchId)
                completion(response)
            }
        }
    }

    private func handleBatchProcessingResult(response: HttpResponse, batchId: String, events: [EventEntity], spans: [SpanEntity]) {
        switch response {
        case .success:
            deleteEventsAndSpans(batchId: batchId, events: events, spans: spans)

            logger.internalLog(level: .debug, message: "Successfully sent batch \(batchId)", error: nil, data: nil)
        case .error(let errorType):
            switch errorType {
                case .clientError(_, _): // swiftlint:disable:this empty_enum_arguments
                deleteEventsAndSpans(batchId: batchId, events: events, spans: spans)
                logger.internalLog(level: .error, message: "Client error while sending batch \(batchId), dropping the batch", error: nil, data: nil)
                default:
                    break
                }
        }
    }

    private func deleteEventsAndSpans(batchId: String, events: [EventEntity], spans: [SpanEntity]) {
        let eventIds = events.map { $0.id }
        let spanIds = spans.map { $0.spanId }
        spanStore.deleteSpans(spanIds: spanIds)
        eventStore.deleteEvents(eventIds: eventIds)
        batchStore.deleteBatch(batchId)
    }
}
