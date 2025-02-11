//
//  SessionStore.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 22/09/24.
//

import CoreData
import Foundation

protocol SessionStore {
    func insertSession(_ session: SessionEntity)
    func getSession(byId sessionId: String) -> SessionEntity?
    func getAllSessions() -> [SessionEntity]?
    func deleteSession(_ sessionId: String)
    func markCrashedSessions(sessionIds: [String])
    func markCrashedSession(sessionId: String)
    func updateNeedsReporting(sessionId: String, needsReporting: Bool)
    func getOldestSession() -> String?
    func deleteSessions(_ sessionIds: [String])
    func getSessionsToDelete() -> [String]?
}

final class BaseSessionStore: SessionStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertSession(_ session: SessionEntity) {
        let context = coreDataManager.backgroundContext
        context.performAndWait { [weak self] in
            let sessionOb = SessionOb(context: context)

            sessionOb.sessionId = session.sessionId
            sessionOb.pid = session.pid
            sessionOb.createdAt = session.createdAt
            sessionOb.needsReporting = session.needsReporting
            sessionOb.crashed = session.crashed

            do {
                try context.saveIfNeeded()
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to save session: \(session.sessionId)", error: error, data: nil)
            }
        }
    }

    func getSession(byId sessionId: String) -> SessionEntity? {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
        fetchRequest.fetchLimit = 1
        fetchRequest.predicate = NSPredicate(format: "sessionId == %@", sessionId)

        var session: SessionEntity?
        context.performAndWait { [weak self] in
            do {
                let result = try context.fetch(fetchRequest).first
                session = result.map { sessionOb in
                    SessionEntity(sessionId: sessionOb.sessionId ?? "",
                            pid: sessionOb.pid,
                            createdAt: sessionOb.createdAt,
                            needsReporting: sessionOb.needsReporting,
                            crashed: sessionOb.crashed)
                }
            } catch {
                guard let self = self else { return }
                logger.internalLog(level: .error, message: "Failed to fetch session: \(sessionId)", error: error, data: nil)
            }
        }
        return session
    }

    func getAllSessions() -> [SessionEntity]? {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()

        var sessions = [SessionEntity]()
        context.performAndWait { [weak self] in
            do {
                let result = try context.fetch(fetchRequest)
                sessions = result.map { sessionOb in
                    SessionEntity(sessionId: sessionOb.sessionId ?? "",
                            pid: sessionOb.pid,
                            createdAt: sessionOb.createdAt,
                            needsReporting: sessionOb.needsReporting,
                            crashed: sessionOb.crashed)
                }
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to fetch sessions.", error: error, data: nil)
            }
        }
        return sessions.isEmpty ? nil : sessions
    }

    func deleteSession(_ sessionId: String) {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
        fetchRequest.fetchLimit = 1
        fetchRequest.predicate = NSPredicate(format: "sessionId == %@", sessionId)

        context.performAndWait { [weak self] in
            do {
                if let sessionOb = try context.fetch(fetchRequest).first {
                    context.delete(sessionOb)
                    try context.saveIfNeeded()
                }
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to delete session: \(sessionId)", error: error, data: nil)
            }
        }
    }

    func markCrashedSessions(sessionIds: [String]) {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
        fetchRequest.fetchLimit = sessionIds.count
        fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessionIds)

        context.performAndWait { [weak self] in
            do {
                let sessions = try context.fetch(fetchRequest)
                for session in sessions {
                    session.crashed = true
                }
                try context.saveIfNeeded()
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to mark crashed sessions.", error: error, data: nil)
            }
        }
    }

    func markCrashedSession(sessionId: String) {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
        fetchRequest.fetchLimit = 1
        fetchRequest.predicate = NSPredicate(format: "sessionId == %@", sessionId)

        context.performAndWait { [weak self] in
            do {
                if let session = try context.fetch(fetchRequest).first {
                    session.crashed = true
                    try context.saveIfNeeded()
                }
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to mark crashed session: \(sessionId)", error: error, data: nil)
            }
        }
    }

    func updateNeedsReporting(sessionId: String, needsReporting: Bool) {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
        fetchRequest.fetchLimit = 1
        fetchRequest.predicate = NSPredicate(format: "sessionId == %@", sessionId)

        context.performAndWait { [weak self] in
            do {
                if let session = try context.fetch(fetchRequest).first {
                    session.needsReporting = needsReporting
                    try context.saveIfNeeded()
                }
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to mark crashed session: \(sessionId)", error: error, data: nil)
            }
        }
    }

    func getOldestSession() -> String? {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
        fetchRequest.fetchLimit = 1
        fetchRequest.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: true)]

        var oldestSessionId: String?
        context.performAndWait {
            do {
                if let oldestSession = try context.fetch(fetchRequest).first {
                    oldestSessionId = oldestSession.sessionId
                }
            } catch {
                logger.internalLog(level: .error, message: "Failed to fetch oldest session.", error: error, data: nil)
            }
        }
        return oldestSessionId
    }

    func deleteSessions(_ sessionIds: [String]) {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
        fetchRequest.fetchLimit = sessionIds.count
        fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessionIds)

        context.performAndWait { [weak self] in
            do {
                let sessions = try context.fetch(fetchRequest)
                for session in sessions {
                    context.delete(session)
                }
                try context.saveIfNeeded()
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to delete sessions: \(sessionIds.joined(separator: ","))", error: error, data: nil)
            }
        }
    }

    func getSessionsToDelete() -> [String]? {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
        fetchRequest.predicate = NSPredicate(format: "needsReporting == %d", false)

        var sessionIds: [String]?
        context.performAndWait { [weak self] in
            do {
                let sessions = try context.fetch(fetchRequest)
                sessionIds = sessions.compactMap { $0.sessionId }
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to fetch sessions to delete.", error: error, data: nil)
            }
        }

        return sessionIds
    }
}
