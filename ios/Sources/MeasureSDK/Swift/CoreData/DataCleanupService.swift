//
//  DataCleanupService.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 14/01/25.
//

import Foundation

protocol DataCleanupService {
    func clearStaleData(completion: @escaping () -> Void)
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

    func clearStaleData(completion: @escaping () -> Void) {
        sessionStore.getSessionsToDelete { [weak self] sessionsToDelete in
            guard let self = self, var sessionsToDelete = sessionsToDelete else {
                completion()
                return
            }

            sessionsToDelete.removeAll { $0 == self.sessionManager.sessionId }

            guard !sessionsToDelete.isEmpty else {
                self.logger.internalLog(level: .info, message: "No stale session data to clear after filtering current session.", error: nil, data: nil)
                completion()
                return
            }

            let group = DispatchGroup()

            group.enter()
            self.sessionStore.deleteSessions(sessionsToDelete) {
                group.leave()
            }

            group.enter()
            self.eventStore.deleteEvents(sessionIds: sessionsToDelete) {
                group.leave()
            }

            group.enter()
            self.spanStore.deleteSpans(sessionIds: sessionsToDelete) {
                group.leave()
            }

            group.notify(queue: .main) {
                self.logger.internalLog(level: .info, message: "Cleared stale session data for \(sessionsToDelete.count) sessions.", error: nil, data: ["sessionIds": sessionsToDelete])
                completion()
            }
        }
    }
}
