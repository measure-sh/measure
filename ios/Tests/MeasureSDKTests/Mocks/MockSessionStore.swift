//
//  MockSessionStore.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 25/01/26.
//

import Foundation
@testable import Measure

final class MockSessionStore: SessionStore {
    private var sessions: [String: SessionEntity] = [:]

    func insertSession(_ session: SessionEntity) {
        sessions[session.sessionId] = session
    }

    func getSession(byId sessionId: String) -> SessionEntity? {
        sessions[sessionId]
    }

    func markCrashedSession(sessionId: String) {
        guard var session = sessions[sessionId] else { return }
        session = SessionEntity(
            sessionId: session.sessionId,
            pid: session.pid,
            createdAt: session.createdAt,
            needsReporting: session.needsReporting,
            crashed: true
        )
        sessions[sessionId] = session
    }

    /// Records every call, including for sessions this mock never held.
    private(set) var updatedNeedsReporting: [String: Bool] = [:]

    func updateNeedsReporting(sessionId: String, needsReporting: Bool) {
        updatedNeedsReporting[sessionId] = needsReporting
        guard var session = sessions[sessionId] else { return }
        session = SessionEntity(
            sessionId: session.sessionId,
            pid: session.pid,
            createdAt: session.createdAt,
            needsReporting: needsReporting,
            crashed: session.crashed
        )
        sessions[sessionId] = session
    }

    func getOldestSession() -> String? {
        sessions.values
            .sorted { $0.createdAt < $1.createdAt }
            .first?
            .sessionId
    }

    func deleteSessions(_ sessionIds: [String]) {
        sessionIds.forEach { sessions.removeValue(forKey: $0) }
    }

    func getSessionsToDelete() -> [String]? {
        let ids = sessions.values
            .filter { !$0.needsReporting }
            .map { $0.sessionId }

        return ids.isEmpty ? nil : ids
    }

    func getPrioritySessionIds() -> [String] {
        sessions.values
            .filter { $0.needsReporting }
            .sorted { $0.createdAt < $1.createdAt }
            .map { $0.sessionId }
    }

    func getAllSessions() -> [SessionEntity] {
        Array(sessions.values)
    }
}
