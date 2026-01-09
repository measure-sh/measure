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
    private let configProvider: ConfigProvider
    private let attachmentStore: AttachmentStore

    init(eventStore: EventStore, spanStore: SpanStore, sessionStore: SessionStore, logger: Logger, sessionManager: SessionManager, configProvider: ConfigProvider, attachmentStore: AttachmentStore) {
        self.eventStore = eventStore
        self.spanStore = spanStore
        self.sessionStore = sessionStore
        self.logger = logger
        self.sessionManager = sessionManager
        self.configProvider = configProvider
        self.attachmentStore = attachmentStore
    }

    func clearStaleData(completion: @escaping () -> Void) {
        trimIfDiskLimitExceeded(currentSessionId: self.sessionManager.sessionId) { [weak self] in
            guard let self else { return }
            self.sessionStore.getSessionsToDelete { [weak self] sessionsToDelete in
                guard let self, var sessionsToDelete = sessionsToDelete else {
                    completion()
                    return
                }

                sessionsToDelete.removeAll { $0 == self.sessionManager.sessionId }

                guard !sessionsToDelete.isEmpty else {
                    self.logger.internalLog(level: .info, message: "No stale session data to clear after filtering current session.", error: nil, data: nil)
                    completion()
                    return
                }

                self.deleteSessionData(sessionIds: sessionsToDelete) {
                    self.logger.internalLog(level: .info, message: "Cleared stale session data for \(sessionsToDelete.count) sessions.", error: nil, data: ["sessionIds": sessionsToDelete])
                    completion()
                }
            }
        }
    }

    func trimIfDiskLimitExceeded(currentSessionId: String, completion: (() -> Void)? = nil) {
        var eventsCount = 0
        var spansCount = 0
        let minDiskLimitMb = 20
        let maxDiskLimitMb = 1500
        let group = DispatchGroup()

        group.enter()
        eventStore.getEventsCount { [weak self] count in
            guard self != nil else { group.leave(); return }
            eventsCount = count
            group.leave()
        }

        group.enter()
        spanStore.getSpansCount { [weak self] count in
            guard self != nil else { group.leave(); return }
            spansCount = count
            group.leave()
        }

        group.notify(queue: .main) { [weak self] in
            guard let self else {
                completion?()
                return
            }

            let totalSignals = eventsCount + spansCount
            let estimatedSizeInMb = (totalSignals * Int(self.configProvider.estimatedEventSizeInKb)) / 1024

            let maxDiskMb = min(max(Int(configProvider.maxDiskUsageInMb), minDiskLimitMb), maxDiskLimitMb)

            if estimatedSizeInMb > maxDiskMb {
                self.deleteOldestSession(excluding: currentSessionId, completion: completion)
            } else {
                completion?()
            }
        }
    }

    private func deleteOldestSession(excluding sessionId: String, completion: (() -> Void)? = nil) {
        sessionStore.getOldestSession { [weak self] oldestSessionId in
            guard let self, let oldestSessionId = oldestSessionId else {
                completion?()
                return
            }

            if oldestSessionId == sessionId {
                self.logger.internalLog(level: .debug, message: "Skipping deletion: oldest session is current session \(sessionId)", error: nil, data: nil)
                completion?()
                return
            }

            self.deleteSessionData(sessionIds: [oldestSessionId]) {
                self.logger.internalLog(level: .info, message: "Deleted oldest session: \(oldestSessionId)", error: nil, data: nil)
                completion?()
            }
        }
    }

    private func deleteSessionData(sessionIds: [String], completion: (() -> Void)? = nil) {
        let group = DispatchGroup()

        group.enter()
        sessionStore.deleteSessions(sessionIds) {
            group.leave()
        }

        group.enter()
        eventStore.deleteEvents(sessionIds: sessionIds) {
            group.leave()
        }

        group.enter()
        spanStore.deleteSpans(sessionIds: sessionIds) {
            group.leave()
        }

        group.enter()
        attachmentStore.deleteAttachments(forSessionIds: sessionIds) {
            group.leave()
        }

        group.notify(queue: .main) {
            completion?()
        }
    }
}
