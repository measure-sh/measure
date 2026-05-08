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
    private let systemFileManager: SystemFileManager
    private let userDefaultsStorage: UserDefaultStorage
    private let maxSdkDebugLogFiles = 5

    init(eventStore: EventStore,
         spanStore: SpanStore,
         sessionStore: SessionStore,
         logger: Logger,
         sessionManager: SessionManager,
         configProvider: ConfigProvider,
         attachmentStore: AttachmentStore,
         systemFileManager: SystemFileManager,
         userDefaultsStorage: UserDefaultStorage) {
        self.eventStore = eventStore
        self.spanStore = spanStore
        self.sessionStore = sessionStore
        self.logger = logger
        self.sessionManager = sessionManager
        self.configProvider = configProvider
        self.attachmentStore = attachmentStore
        self.systemFileManager = systemFileManager
        self.userDefaultsStorage = userDefaultsStorage
    }

    func clearStaleData() {
        trimIfDiskLimitExceeded(currentSessionId: sessionManager.sessionId)
        attachmentStore.deleteExpiredAttachments()
        trimSdkDebugLogs()

        guard var sessionsToDelete = sessionStore.getSessionsToDelete() else {
            return
        }

        sessionsToDelete.removeAll { $0 == sessionManager.sessionId }

        guard !sessionsToDelete.isEmpty else {
            logger.internalLog(
                level: .info,
                message: "DataCleanupService: No stale session data to clear after filtering current session.",
                error: nil,
                data: nil
            )
            return
        }

        deleteSessionData(sessionIds: sessionsToDelete)
        logger.internalLog(
            level: .info,
            message: "DataCleanupService: Cleared stale session data for \(sessionsToDelete.count) sessions.",
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
            message: "DataCleanupService: Deleting \(sessionsToDelete.count) empty sessions",
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
                message: "DataCleanupService: Skipping deletion: oldest session is current session \(sessionId)",
                error: nil,
                data: nil
            )
            return
        }

        deleteSessionData(sessionIds: [oldestSessionId])
        logger.internalLog(
            level: .info,
            message: "DataCleanupService: Deleted oldest session: \(oldestSessionId)",
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

    private func trimSdkDebugLogs() {
        guard systemFileManager.getSdkDebugLogsDirectory() != nil else { return }

        let files = systemFileManager.getContentsOfDebugLogsDirectory()
        guard files.count > maxSdkDebugLogFiles else { return }

        let filesToDelete = files
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
            .dropLast(maxSdkDebugLogFiles)

        logger.log(
            level: .debug,
            message: "Cleanup: Deleting \(filesToDelete.count) old SDK debug log files",
            error: nil,
            data: nil
        )

        filesToDelete.forEach { systemFileManager.deleteFile(atPath: $0.path) }
    }
}
