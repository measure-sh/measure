//
//  DataCleanupService.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 14/01/25.
//

import Foundation

protocol DataCleanupService {
    func clearStaleData()
}

final class BaseDataCleanupService: DataCleanupService {
    private let eventStore: EventStore
    private let spanStore: SpanStore
    private let sessionStore: SessionStore
    private let logger: Logger
    private let sessionManager: SessionManager
    private let configProvider: ConfigProvider
    private let attachmentStore: AttachmentStore

    init(eventStore: EventStore,
         spanStore: SpanStore,
         sessionStore: SessionStore,
         logger: Logger,
         sessionManager: SessionManager,
         configProvider: ConfigProvider,
         attachmentStore: AttachmentStore) {
        self.eventStore = eventStore
        self.spanStore = spanStore
        self.sessionStore = sessionStore
        self.logger = logger
        self.sessionManager = sessionManager
        self.configProvider = configProvider
        self.attachmentStore = attachmentStore
    }

    func clearStaleData() {
        trimIfDiskLimitExceeded(currentSessionId: sessionManager.sessionId)

        guard var sessionsToDelete = sessionStore.getSessionsToDelete() else {
            return
        }

        sessionsToDelete.removeAll { $0 == sessionManager.sessionId }

        guard !sessionsToDelete.isEmpty else {
            logger.internalLog(
                level: .info,
                message: "Cleanup Service: No stale session data to clear after filtering current session.",
                error: nil,
                data: nil
            )
            return
        }

        deleteSessionData(sessionIds: sessionsToDelete)
        logger.internalLog(
            level: .info,
            message: "Cleanup Service: Cleared stale session data for \(sessionsToDelete.count) sessions.",
            error: nil,
            data: ["sessionIds": sessionsToDelete]
        )
    }

    private func deleteEmptySessions(currentSessionId: String) {
        guard let sessionIds = sessionStore.getSessionsToDelete() else { return }

        var sessionsToDelete: [String] = []

        for sessionId in sessionIds where sessionId != currentSessionId {
            let eventCount = eventStore
                .getEventsForSessions(sessions: [sessionId])?
                .count ?? 0

            let spanCount = spanStore.getSpansCount(sessionId: sessionId)

            if eventCount + spanCount == 0 {
                sessionsToDelete.append(sessionId)
            }
        }

        guard !sessionsToDelete.isEmpty else { return }

        logger.internalLog(
            level: .debug,
            message: "Exporter: Deleting \(sessionsToDelete.count) empty sessions",
            error: nil,
            data: ["sessionIds": sessionsToDelete]
        )

        deleteSessionData(sessionIds: sessionsToDelete)
    }

    func trimIfDiskLimitExceeded(currentSessionId: String) {
        let eventsCount = eventStore.getEventsCount()
        let spansCount = spanStore.getSpansCount()

        let minDiskLimitMb = 20
        let maxDiskLimitMb = 1500

        let totalSignals = eventsCount + spansCount
        let estimatedSizeInMb =
            (totalSignals * Int(configProvider.estimatedEventSizeInKb)) / 1024

        let maxDiskMb = min(
            max(Int(configProvider.maxDiskUsageInMb), minDiskLimitMb),
            maxDiskLimitMb
        )

        guard estimatedSizeInMb > maxDiskMb else { return }

        deleteOldestSession(excluding: currentSessionId)
    }

    private func deleteOldestSession(excluding sessionId: String) {
        guard let oldestSessionId = sessionStore.getOldestSession() else { return }

        guard oldestSessionId != sessionId else {
            logger.internalLog(
                level: .debug,
                message: "Cleanup Service: Skipping deletion: oldest session is current session \(sessionId)",
                error: nil,
                data: nil
            )
            return
        }

        deleteSessionData(sessionIds: [oldestSessionId])
        logger.internalLog(
            level: .info,
            message: "Cleanup Service: Deleted oldest session: \(oldestSessionId)",
            error: nil,
            data: nil
        )
    }

    private func deleteSessionData(sessionIds: [String]) {
        sessionStore.deleteSessions(sessionIds)
        eventStore.deleteEvents(sessionIds: sessionIds)
        spanStore.deleteSpans(sessionIds: sessionIds)
        attachmentStore.deleteAttachments(forSessionIds: sessionIds)
    }
}
