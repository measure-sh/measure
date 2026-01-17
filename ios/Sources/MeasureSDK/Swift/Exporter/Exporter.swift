//
//  Exporter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/10/24.
//

import Foundation

protocol Exporter {
    func export()
}

// TODO: Add tests
final class BaseExporter: Exporter {
    private let logger: Logger
    private let idProvider: IdProvider
    private let dispatchQueue: DispatchQueue
    private let timeProvider: TimeProvider
    private let networkClient: NetworkClient
    private let httpClient: HttpClient
    private let eventStore: EventStore
    private let spanStore: SpanStore
    private let batchStore: BatchStore
    private let attachmentStore: AttachmentStore
    private let attachmentExporter: AttachmentExporter
    private let configProvider: ConfigProvider
    private let systemFileManager: SystemFileManager

    private let isExporting = AtomicBool(false)

    init(logger: Logger,
         idProvider: IdProvider,
         dispatchQueue: DispatchQueue,
         timeProvider: TimeProvider,
         networkClient: NetworkClient,
         httpClient: HttpClient,
         eventStore: EventStore,
         spanStore: SpanStore,
         batchStore: BatchStore,
         attachmentStore: AttachmentStore,
         attachmentExporter: AttachmentExporter,
         configProvider: ConfigProvider,
         systemFileManager: SystemFileManager) {
        self.logger = logger
        self.idProvider = idProvider
        self.dispatchQueue = dispatchQueue
        self.timeProvider = timeProvider
        self.networkClient = networkClient
        self.httpClient = httpClient
        self.eventStore = eventStore
        self.spanStore = spanStore
        self.batchStore = batchStore
        self.attachmentStore = attachmentStore
        self.attachmentExporter = attachmentExporter
        self.configProvider = configProvider
        self.systemFileManager = systemFileManager
    }

    func export() {
        var started = false
        isExporting.setTrueIfFalse {
            started = true
        }

        guard started else {
            logger.internalLog(level: .debug, message: "Exporter: export already in progress, skipping", error: nil, data: nil)
            return
        }

        defer {
            isExporting.set(false)
        }

        exportEvents()
        exportAttachments()
    }

    private func exportEvents() {
        dispatchQueue.async {
            let batchIds = self.getBatchIds()

            if !batchIds.isEmpty {
                self.logger.internalLog(level: .debug, message: "Exporter: found \(batchIds.count) existing batches, exporting", error: nil, data: nil)

                let success = self.exportBatches(batchIds)
                if !success {
                    return
                }
            }

            let createdCount = self.createNewBatches()
            if createdCount > 0 {
                self.logger.internalLog(level: .debug, message: "Exporter: created \(createdCount) new batches, exporting", error: nil, data: nil)

                let newBatchIds = self.getBatchIds()
                if !newBatchIds.isEmpty {
                    _ = self.exportBatches(newBatchIds)
                }
            } else {
                self.logger.internalLog(level: .debug, message: "Exporter: no batches to export", error: nil, data: nil)
            }
        }
    }

    private func exportBatches(_ batchIds: [String]) -> Bool {
        for (index, batchId) in batchIds.enumerated() {
            guard let batch = getBatch(by: batchId) else {
                return false
            }

            let success = exportBatch(batch)
            if !success {
                return false
            }

            if index < batchIds.count - 1 {
                Thread.sleep(forTimeInterval: TimeInterval(configProvider.batchExportIntervalMs) / 1000)
            }
        }
        return true
    }

    private func exportBatch(_ batch: BatchEntity) -> Bool {
        if batch.eventIds.isEmpty && batch.spanIds.isEmpty {
            logger.internalLog(level: .error, message: "Exporter: invalid batch, no events or spans found for batch \(batch.batchId)", error: nil, data: nil)
            deleteBatch(batch)
            return false
        }

        let events = getEvents(batch.eventIds)
        let spans = getSpans(batch.spanIds)

        if events.isEmpty && spans.isEmpty {
            logger.internalLog(level: .error, message: "Exporter: invalid export request, no events or spans found for batch", error: nil, data: nil)
            deleteBatch(batch)
            return false
        }

        logger.internalLog(level: .debug, message: "Exporter: exporting batch \(batch.batchId) with \(events.count) events and \(spans.count) spans", error: nil, data: nil)

        let response = networkClient.execute(batchId: batch.batchId,
                                             events: events,
                                             spans: spans)

        handleBatchProcessingResult(response: response,
                                    batchId: batch.batchId,
                                    events: events,
                                    spans: spans)

        if case .success = response {
            return true
        }
        return false
    }

    private func exportAttachments() {
        attachmentExporter.onNewAttachmentsAvailable()
    }

    private func handleBatchProcessingResult(response: HttpResponse,
                                             batchId: String,
                                             events: [EventEntity],
                                             spans: [SpanEntity]) {
        switch response {
        case .success(let body):
            self.parseAndSaveAttachmentMetadata(responseBody: body)
            self.attachmentExporter.onNewAttachmentsAvailable()
            self.deleteEventsAndSpans(batchId: batchId, events: events, spans: spans)
            self.logger.internalLog(level: .debug, message: "Successfully sent batch \(batchId)", error: nil, data: nil)

        case .error(let errorType):
            switch errorType {
            case .clientError:
                self.deleteEventsAndSpans(batchId: batchId, events: events, spans: spans)
                self.logger.internalLog(level: .error, message: "Client error while sending batch \(batchId), dropping the batch", error: nil, data: nil)
            default:
                break
            }
        }
    }

    private func deleteEventsAndSpans(batchId: String,
                                      events: [EventEntity],
                                      spans: [SpanEntity]) {
        let eventIds = events.map { $0.id }
        let spanIds = spans.map { $0.spanId }

        spanStore.deleteSpans(spanIds: spanIds)
        eventStore.deleteEvents(eventIds: eventIds)
        batchStore.deleteBatch(batchId)
    }

    private func parseAndSaveAttachmentMetadata(responseBody: String?) {
        guard let responseBody,
              let data = responseBody.data(using: .utf8) else {
            logger.internalLog(level: .error, message: "Failed to convert response body to Data.", error: nil, data: nil)
            return
        }

        do {
            let json = try JSONDecoder().decode([String: [ResponseAttachment]].self, from: data)
            guard let responseAttachments = json["attachments"] else { return }

            for attachment in responseAttachments {
                let headersData = attachment.headers.flatMap {
                    try? JSONSerialization.data(withJSONObject: $0)
                }

                attachmentStore.updateUploadDetails(for: attachment.id,
                                                    uploadUrl: attachment.upload_url,
                                                    headers: headersData,
                                                    expiresAt: attachment.expires_at) {}
            }
        } catch {
            logger.internalLog(level: .error, message: "Failed to decode batch response for attachments.", error: error, data: nil)
        }
    }

    private func getBatchIds() -> [String] {
        return batchStore.getBatches(Int.max).map { $0.batchId }
    }

    private func getBatch(by id: String) -> BatchEntity? {
        return batchStore.getBatch(id)
    }

    private func getEvents(_ ids: [String]) -> [EventEntity] {
        return eventStore.getEvents(eventIds: ids) ?? []
    }

    private func getSpans(_ ids: [String]) -> [SpanEntity] {
        return spanStore.getSpans(spanIds: ids) ?? []
    }

    private func deleteBatch(_ batch: BatchEntity) {
        batchStore.deleteBatch(batch.batchId)
        spanStore.deleteSpans(spanIds: batch.spanIds)
        eventStore.deleteEvents(eventIds: batch.eventIds)
    }

    private func createNewBatches() -> Int {
        var batchesInserted = 0

        // 1. Fetch sessionIds that have unbatched events
        let sessionIds = eventStore.getSessionIdsWithUnBatchedEvents()

        guard !sessionIds.isEmpty else {
            return 0
        }

        let maxBatchSize = configProvider.maxEventsInBatch
        let insertionBatchSize = 1000

        var currentBatchId = idProvider.uuid()
        var currentBatchSize = 0

        var eventIds = Set<String>()
        var spanIds = Set<String>()

        func insertBatchIfNeeded() {
            guard !eventIds.isEmpty || !spanIds.isEmpty else { return }

            let batch = BatchEntity(batchId: currentBatchId,
                                    eventIds: Array(eventIds),
                                    spanIds: Array(spanIds),
                                    createdAt: timeProvider.now())

            let inserted = batchStore.insertBatch(batch)

            if inserted {
                batchesInserted += 1
                eventStore.updateBatchId(currentBatchId, for: Array(eventIds))
                spanStore.updateBatchId(currentBatchId, for: Array(spanIds))
            }

            eventIds.removeAll()
            spanIds.removeAll()
        }

        func createNewBatch() {
            insertBatchIfNeeded()
            currentBatchId = idProvider.uuid()
            currentBatchSize = 0
        }

        func addEvent(_ id: String) {
            eventIds.insert(id)
            currentBatchSize += 1

            if currentBatchSize >= maxBatchSize {
                createNewBatch()
            } else if eventIds.count + spanIds.count >= insertionBatchSize {
                insertBatchIfNeeded()
            }
        }

        func addSpan(_ id: String) {
            spanIds.insert(id)
            currentBatchSize += 1

            if currentBatchSize >= maxBatchSize {
                createNewBatch()
            } else if eventIds.count + spanIds.count >= insertionBatchSize {
                insertBatchIfNeeded()
            }
        }

        // 2. Process sessions
        for sessionId in sessionIds {
            let unbatchedEvents = eventStore.getUnBatchedEvents(eventCount: Number(maxBatchSize),
                                                                ascending: true,
                                                                sessionId: sessionId)

            for eventId in unbatchedEvents {
                addEvent(eventId)
            }
        }

        // 3. Add unbatched spans
        let unbatchedSpans = spanStore.getUnBatchedSpans(spanCount: Int64(maxBatchSize),
                                                         ascending: true)

        for spanId in unbatchedSpans {
            addSpan(spanId)
        }

        insertBatchIfNeeded()

        return batchesInserted
    }
}

private struct ResponseAttachment: Codable {
    let id: String
    let type: String
    let filename: String
    let upload_url: String
    let expires_at: String
    let headers: [String: String]?
}
