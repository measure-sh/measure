//
//  SessionStore.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 22/09/24.
//

import CoreData
import Foundation

protocol SessionStore {
    func insertSession(_ session: SessionEntity) async
    func getSession(byId sessionId: String) async -> SessionEntity?
    func getAllSessions() async -> [SessionEntity]?
    func deleteSession(_ sessionId: String) async
    func markCrashedSessions(sessionIds: [String]) async
    func markCrashedSession(sessionId: String) async
    func updateNeedsReporting(sessionId: String, needsReporting: Bool) async
    func getOldestSession() async -> String?
    func deleteSessions(_ sessionIds: [String]) async
    func getSessionsToDelete() async -> [String]?
}

final class BaseSessionStore: SessionStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertSession(_ session: SessionEntity) async {
        await coreDataManager.performBackgroundTask { context in
            let sessionOb = SessionOb(context: context)
            sessionOb.sessionId = session.sessionId
            sessionOb.pid = session.pid
            sessionOb.createdAt = session.createdAt
            sessionOb.needsReporting = session.needsReporting
            sessionOb.crashed = session.crashed

            do {
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to save session: \(session.sessionId)", error: error, data: nil)
            }
        }
    }

    func getSession(byId sessionId: String) async -> SessionEntity? {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
            fetchRequest.fetchLimit = 1
            fetchRequest.predicate = NSPredicate(format: "sessionId == %@", sessionId)

            do {
                if let sessionOb = try context.fetch(fetchRequest).first {
                    return SessionEntity(
                        sessionId: sessionOb.sessionId ?? "",
                        pid: sessionOb.pid,
                        createdAt: sessionOb.createdAt,
                        needsReporting: sessionOb.needsReporting,
                        crashed: sessionOb.crashed
                    )
                }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch session: \(sessionId)", error: error, data: nil)
            }
            return nil
        }
    }

    func getAllSessions() async -> [SessionEntity]? {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()

            do {
                let results = try context.fetch(fetchRequest)
                let sessions = results.map { sessionOb in
                    SessionEntity(
                        sessionId: sessionOb.sessionId ?? "",
                        pid: sessionOb.pid,
                        createdAt: sessionOb.createdAt,
                        needsReporting: sessionOb.needsReporting,
                        crashed: sessionOb.crashed
                    )
                }
                return sessions.isEmpty ? nil : sessions
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch sessions.", error: error, data: nil)
                return nil
            }
        }
    }

    func deleteSession(_ sessionId: String) async {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
            fetchRequest.fetchLimit = 1
            fetchRequest.predicate = NSPredicate(format: "sessionId == %@", sessionId)

            do {
                if let sessionOb = try context.fetch(fetchRequest).first {
                    context.delete(sessionOb)
                    try context.saveIfNeeded()
                }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to delete session: \(sessionId)", error: error, data: nil)
            }
        }
    }

    func markCrashedSessions(sessionIds: [String]) async {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
            fetchRequest.fetchLimit = sessionIds.count
            fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessionIds)

            do {
                let sessions = try context.fetch(fetchRequest)
                for session in sessions {
                    session.crashed = true
                }
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to mark crashed sessions.", error: error, data: nil)
            }
        }
    }

    func markCrashedSession(sessionId: String) async {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
            fetchRequest.fetchLimit = 1
            fetchRequest.predicate = NSPredicate(format: "sessionId == %@", sessionId)

            do {
                if let session = try context.fetch(fetchRequest).first {
                    session.crashed = true
                    try context.saveIfNeeded()
                }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to mark crashed session: \(sessionId)", error: error, data: nil)
            }
        }
    }

    func updateNeedsReporting(sessionId: String, needsReporting: Bool) async {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
            fetchRequest.fetchLimit = 1
            fetchRequest.predicate = NSPredicate(format: "sessionId == %@", sessionId)

            do {
                if let session = try context.fetch(fetchRequest).first {
                    session.needsReporting = needsReporting
                    try context.saveIfNeeded()
                }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to update needsReporting for session: \(sessionId)", error: error, data: nil)
            }
        }
    }

    func getOldestSession() async -> String? {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
            fetchRequest.fetchLimit = 1
            fetchRequest.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: true)]

            do {
                if let oldestSession = try context.fetch(fetchRequest).first {
                    return oldestSession.sessionId
                }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch oldest session.", error: error, data: nil)
            }
            return nil
        }
    }

    func deleteSessions(_ sessionIds: [String]) async {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
            fetchRequest.fetchLimit = sessionIds.count
            fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessionIds)

            do {
                let sessions = try context.fetch(fetchRequest)
                for session in sessions {
                    context.delete(session)
                }
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to delete sessions: \(sessionIds.joined(separator: ","))", error: error, data: nil)
            }
        }
    }

    func getSessionsToDelete() async -> [String]? {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "needsReporting == %d", false)

            do {
                let sessions = try context.fetch(fetchRequest)
                return sessions.compactMap { $0.sessionId }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch sessions to delete.", error: error, data: nil)
                return nil
            }
        }
    }
}
