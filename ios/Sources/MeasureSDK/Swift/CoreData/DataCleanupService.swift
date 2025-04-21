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

    init(eventStore: EventStore, spanStore: SpanStore, sessionStore: SessionStore, logger: Logger, sessionManager: SessionManager) {
        self.eventStore = eventStore
        self.spanStore = spanStore
        self.sessionStore = sessionStore
        self.logger = logger
        self.sessionManager = sessionManager
    }

    func clearStaleData() {
        guard let sessionsToDelete = getSessionsToDelete() else {
            logger.internalLog(level: .info, message: "No session data to clear.", error: nil, data: nil)
            return
        }

        sessionStore.deleteSessions(sessionsToDelete)
        eventStore.deleteEvents(sessionIds: sessionsToDelete)
        spanStore.deleteSpans(sessionIds: sessionsToDelete)
    }

    private func getSessionsToDelete() -> [String]? {
        guard var sessionsToDelete = sessionStore.getSessionsToDelete() else {
            return nil
        }

        sessionsToDelete.removeAll { $0 == sessionManager.sessionId }

        return sessionsToDelete
    }
}
