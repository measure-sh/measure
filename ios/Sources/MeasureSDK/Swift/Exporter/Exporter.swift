//
//  Exporter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/10/24.
//

import Foundation
import UIKit

protocol Exporter {
    func export()
}

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
    private let sessionStore: SessionStore
    private let configProvider: ConfigProvider
    private let isExporting = AtomicBool(false)
    private let systemFileManager: SystemFileManager
    private var backgroundTaskId: UIBackgroundTaskIdentifier = .invalid

    init(
        logger: Logger,
        idProvider: IdProvider,
        dispatchQueue: DispatchQueue,
        timeProvider: TimeProvider,
        networkClient: NetworkClient,
        httpClient: HttpClient,
        eventStore: EventStore,
        spanStore: SpanStore,
        batchStore: BatchStore,
        attachmentStore: AttachmentStore,
        sessionStore: SessionStore,
        configProvider: ConfigProvider,
        systemFileManager: SystemFileManager
    ) {
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
        self.sessionStore = sessionStore
        self.configProvider = configProvider
        self.systemFileManager = systemFileManager
    }

    func export() {
        var started = false
        isExporting.setTrueIfFalse { started = true }

        guard started else {
            logger.internalLog(level: .debug, message: "Exporter: export already in progress, skipping", error: nil, data: nil)
            return
        }

        logger.internalLog(level: .debug, message: "Exporter: starting export", error: nil, data: nil)

        startBackgroundTask()

        dispatchQueue.async { [weak self] in
            guard let self else { return }

            self.exportEvents()
            self.exportAttachments()

            self.isExporting.set(false)
            self.endBackgroundTask()

            self.logger.internalLog(level: .debug, message: "Exporter: export finished", error: nil, data: nil)
        }
    }

    private func startBackgroundTask() {
        guard backgroundTaskId == .invalid else { return }

        backgroundTaskId = UIApplication.shared.beginBackgroundTask(withName: "measure.export") { [weak self] in
            guard let self else { return }
            self.logger.internalLog(level: .warning, message: "Exporter: background time expired", error: nil, data: nil)
            self.isExporting.set(false)
            self.endBackgroundTask()
        }

        logger.internalLog(level: .debug, message: "Exporter: background task started", error: nil, data: nil)
    }

    private func endBackgroundTask() {
        guard backgroundTaskId != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTaskId)
        backgroundTaskId = .invalid
        logger.internalLog(level: .debug, message: "Exporter: background task ended", error: nil, data: nil)
    }

    private func exportEvents() {
        let batchIds = getBatchIds()

        if !batchIds.isEmpty {
            if !exportBatches(batchIds) { return }
        }

        let created = createNewBatches()
        guard created > 0 else { return }

        let newBatchIds = getBatchIds()
        if !newBatchIds.isEmpty { _ = exportBatches(newBatchIds) }
    }

    private func exportBatches(_ batchIds: [String]) -> Bool {
        for (index, batchId) in batchIds.enumerated() {
            guard let batch = batchStore.getBatch(batchId) else {
                logger.internalLog(level: .error, message: "Exporter: failed to fetch batch \(batchId)", error: nil, data: nil)
                return false
            }

            logger.internalLog(level: .debug, message: "Exporter: exporting batch \(batchId)", error: nil, data: nil)

            let success = exportBatch(batch)
            if !success {
                logger.internalLog(level: .debug, message: "Exporter: batch \(batchId) failed", error: nil, data: nil)
                return false
            }

            if index < batchIds.count - 1 {
                Thread.sleep(forTimeInterval: TimeInterval(configProvider.batchExportIntervalMs) / 1000)
            }
        }
        return true
    }

    private func exportBatch(_ batch: BatchEntity) -> Bool {
        let events = eventStore.getEvents(eventIds: batch.eventIds) ?? []
        let spans = spanStore.getSpans(spanIds: batch.spanIds) ?? []

        guard !events.isEmpty || !spans.isEmpty else {
            logger.internalLog(level: .error, message: "Exporter: batch \(batch.batchId) is empty, deleting", error: nil, data: nil)
            deleteBatch(batch)
            return false
        }

        logger.internalLog(level: .debug, message: "Exporter: batch \(batch.batchId) has \(events.count) events, \(spans.count) spans", error: nil, data: nil)

        let response = networkClient.execute(batchId: batch.batchId, events: events, spans: spans)
        handleBatchResponse(response: response, batch: batch, events: events, spans: spans)

        if case .success = response {
            return true
        }
        return false
    }

    private func handleBatchResponse(response: HttpResponse, batch: BatchEntity, events: [EventEntity], spans: [SpanEntity]) {
        switch response {
        case .success(let body, _):
            logger.internalLog(level: .debug, message: "Exporter: batch \(batch.batchId) sent successfully", error: nil, data: nil)
            parseAndSaveAttachmentMetadata(responseBody: body)
            deleteEventsAndSpans(batch, events: events, spans: spans)

        case .error(let errorType):
            logger.internalLog(level: .error, message: "Exporter: batch \(batch.batchId) failed with \(errorType)", error: nil, data: nil)
            if case .clientError = errorType { deleteEventsAndSpans(batch, events: events, spans: spans) }
        }
    }

    private func exportAttachments() {
        while true {
            let attachments = attachmentStore.getAttachmentsForUpload(batchSize: 5)
            guard !attachments.isEmpty else {
                logger.internalLog(level: .debug, message: "Exporter: no attachments to upload", error: nil, data: nil)
                break
            }

            logger.internalLog(level: .debug, message: "Exporter: uploading \(attachments.count) attachments", error: nil, data: nil)

            for attachment in attachments {
                logger.internalLog(level: .debug, message: "Exporter: uploading attachment \(attachment.id)", error: nil, data: nil)
                let success = uploadAttachmentSync(attachment)
                if !success {
                    logger.internalLog(level: .debug, message: "Exporter: attachment \(attachment.id) upload failed", error: nil, data: nil)
                    break
                }
                Thread.sleep(forTimeInterval: TimeInterval(configProvider.attachmentExportIntervalMs) / 1000)
            }
        }
    }

    private func uploadAttachmentSync(_ attachment: MsrUploadAttachment) -> Bool {
        var bytes: Data?
        if let path = attachment.path {
            bytes = systemFileManager.retrieveFile(atPath: path)
        }
        guard
            let bytes = bytes ?? attachment.bytes,
            let uploadUrlString = attachment.uploadUrl,
            let uploadUrl = URL(string: uploadUrlString),
            let headersData = attachment.headers,
            let headers = deserializeHeaders(headersData)
        else {
            attachmentStore.deleteAttachments(attachmentIds: [attachment.id])
            return false
        }

        let response = httpClient.uploadFile(
            url: uploadUrl, method: .put, contentType: attachment.contentType,
            contentEncoding: attachment.contentEncoding, headers: headers, fileData: bytes)

        logger.log(level: .info, message: "Exporter: attachement response: \(response)", error: nil, data: nil)
        switch response {
        case .success:
            attachmentStore.deleteAttachments(attachmentIds: [attachment.id])
            return true
        case .error(let errorType):
            if case .clientError = errorType { attachmentStore.deleteAttachments(attachmentIds: [attachment.id]) }
            return false
        }
    }

    private func parseAndSaveAttachmentMetadata(responseBody: String?) {
        guard let responseBody, let data = responseBody.data(using: .utf8) else { return }

        do {
            let decoded = try JSONDecoder().decode([String: [ResponseAttachment]].self, from: data)
            guard let attachments = decoded["attachments"] else { return }

            for attachment in attachments {
                let headersData = attachment.headers.flatMap { try? JSONSerialization.data(withJSONObject: $0) }
                attachmentStore.updateUploadDetails(for: attachment.id, uploadUrl: attachment.upload_url, headers: headersData, expiresAt: attachment.expires_at)
            }
        } catch {
            logger.internalLog(level: .error, message: "Exporter: failed to decode attachment metadata", error: error, data: nil)
        }
    }

    private func deserializeHeaders(_ data: Data) -> [String: String]? {
        try? JSONSerialization.jsonObject(with: data) as? [String: String]
    }

    private func createNewBatches() -> Int {
        let sessionIds = eventStore.getSessionIdsWithUnBatchedEvents()
        guard !sessionIds.isEmpty else { return 0 }

        let prioritySessionIds = sessionStore.getPrioritySessionIds()
        let orderedSessionIds = prioritySessionIds.filter(sessionIds.contains) + sessionIds.filter { !prioritySessionIds.contains($0) }

        let maxBatchSize = configProvider.maxEventsInBatch
        var inserted = 0

        func flushBatch(eventIds: inout Set<String>, spanIds: inout Set<String>) {
            guard !eventIds.isEmpty || !spanIds.isEmpty else { return }

            let batchId = idProvider.uuid()
            let batch = BatchEntity(batchId: batchId, eventIds: Array(eventIds), spanIds: Array(spanIds), createdAt: timeProvider.now())
            if batchStore.insertBatch(batch) {
                inserted += 1
                eventStore.updateBatchId(batchId, for: Array(eventIds))
                spanStore.updateBatchId(batchId, for: Array(spanIds))
            } else {
                logger.internalLog(level: .error, message: "Exporter: Failed to insert batch \(batchId)", error: nil, data: nil)
            }

            eventIds.removeAll()
            spanIds.removeAll()
        }

        var currentEventIds = Set<String>()
        var currentSpanIds = Set<String>()

        // Process all sessions
        for sessionId in orderedSessionIds {
            let events = eventStore.getUnBatchedEvents(eventCount: Number.max, ascending: true, sessionId: sessionId)

            for eventId in events {
                currentEventIds.insert(eventId)

                if currentEventIds.count >= maxBatchSize {
                    flushBatch(eventIds: &currentEventIds, spanIds: &currentSpanIds)
                }
            }
        }

        // Process all spans
        let spans = spanStore.getUnBatchedSpans(spanCount: Int64.max, ascending: true)

        for spanId in spans {
            currentSpanIds.insert(spanId)

            if currentSpanIds.count >= maxBatchSize {
                flushBatch(eventIds: &currentEventIds, spanIds: &currentSpanIds)
            }
        }

        flushBatch(eventIds: &currentEventIds, spanIds: &currentSpanIds)

        logger.internalLog(level: .debug, message: "Exporter: total batches inserted: \(inserted)", error: nil, data: nil)
        return inserted
    }

    private func deleteEventsAndSpans(_ batch: BatchEntity, events: [EventEntity], spans: [SpanEntity]) {
        eventStore.deleteEvents(eventIds: events.map { $0.id })
        spanStore.deleteSpans(spanIds: spans.map { $0.spanId })
        batchStore.deleteBatch(batch.batchId)
    }

    private func deleteBatch(_ batch: BatchEntity) {
        batchStore.deleteBatch(batch.batchId)
        eventStore.deleteEvents(eventIds: batch.eventIds)
        spanStore.deleteSpans(spanIds: batch.spanIds)
    }

    private func getBatchIds() -> [String] {
        batchStore.getBatches(Int.max).map { $0.batchId }
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
