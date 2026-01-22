//
//  SessionStore.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 22/09/24.
//

import CoreData
import Foundation

protocol SessionStore {
    func insertSession(_ session: SessionEntity, completion: @escaping () -> Void)
    func getSession(byId sessionId: String, completion: @escaping (SessionEntity?) -> Void)
    func getAllSessions(completion: @escaping ([SessionEntity]?) -> Void)
    func deleteSession(_ sessionId: String, completion: @escaping () -> Void)
    func markCrashedSessions(sessionIds: [String])
    func markCrashedSession(sessionId: String, completion: @escaping () -> Void)
    func updateNeedsReporting(sessionId: String, needsReporting: Bool)
    func getOldestSession(completion: @escaping (String?) -> Void)
    func deleteSessions(_ sessionIds: [String], completion: @escaping () -> Void)
    func getSessionsToDelete(completion: @escaping ([String]?) -> Void)
    func getPrioritySessionIds() -> [String]
}

final class BaseSessionStore: SessionStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertSession(_ session: SessionEntity, completion: @escaping () -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion()
                return
            }

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

            completion()
        }
    }

    func getSession(byId sessionId: String, completion: @escaping (SessionEntity?) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion(nil)
                return
            }

            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
            fetchRequest.fetchLimit = 1
            fetchRequest.predicate = NSPredicate(format: "sessionId == %@", sessionId)

            do {
                if let sessionOb = try context.fetch(fetchRequest).first {
                    let session = SessionEntity(sessionId: sessionOb.sessionId ?? "",
                                                pid: sessionOb.pid,
                                                createdAt: sessionOb.createdAt,
                                                needsReporting: sessionOb.needsReporting,
                                                crashed: sessionOb.crashed)
                    completion(session)
                } else {
                    completion(nil)
                }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch session: \(sessionId)", error: error, data: nil)
                completion(nil)
            }
        }
    }

    func getAllSessions(completion: @escaping ([SessionEntity]?) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion(nil)
                return
            }

            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()

            do {
                let result = try context.fetch(fetchRequest)
                let sessions = result.map {
                    SessionEntity(sessionId: $0.sessionId ?? "",
                                  pid: $0.pid,
                                  createdAt: $0.createdAt,
                                  needsReporting: $0.needsReporting,
                                  crashed: $0.crashed)
                }
                completion(sessions.isEmpty ? nil : sessions)
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch sessions.", error: error, data: nil)
                completion(nil)
            }
        }
    }

    func deleteSession(_ sessionId: String, completion: @escaping () -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion()
                return
            }

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

            completion()
        }
    }

    func markCrashedSessions(sessionIds: [String]) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { return }

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

    func markCrashedSession(sessionId: String, completion: @escaping () -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion()
                return
            }

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

            completion()
        }
    }

    func updateNeedsReporting(sessionId: String, needsReporting: Bool) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { return }

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

    func getOldestSession(completion: @escaping (String?) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion(nil)
                return
            }

            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
            fetchRequest.fetchLimit = 1
            fetchRequest.sortDescriptors = [NSSortDescriptor(key: "createdAt", ascending: true)]

            do {
                let session = try context.fetch(fetchRequest).first
                completion(session?.sessionId)
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch oldest session.", error: error, data: nil)
                completion(nil)
            }
        }
    }

    func deleteSessions(_ sessionIds: [String], completion: @escaping () -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion()
                return
            }

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

            completion()
        }
    }

    func getSessionsToDelete(completion: @escaping ([String]?) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion(nil)
                return
            }

            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "needsReporting == %d", false)

            do {
                let sessions = try context.fetch(fetchRequest)
                let sessionIds = sessions.compactMap { $0.sessionId }
                completion(sessionIds)
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch sessions to delete.", error: error, data: nil)
                completion(nil)
            }
        }
    }

    func getPrioritySessionIds() -> [String] {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "Background context not available", error: nil, data: nil)
            return []
        }

        var sessionIds: [String] = []

        context.performAndWait {
            let fetchRequest: NSFetchRequest<SessionOb> = SessionOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "needsReporting == %d", true)
            fetchRequest.sortDescriptors = [
                NSSortDescriptor(key: "createdAt", ascending: true)
            ]

            do {
                let sessions = try context.fetch(fetchRequest)
                sessionIds = sessions.compactMap { $0.sessionId }
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to fetch priority sessions",
                    error: error,
                    data: nil
                )
            }
        }

        return sessionIds
    }
}
