//
//  EventStore.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 24/09/24.
//

import CoreData
import Foundation

protocol EventStore {
    func insertEvent(event: EventEntity)
    func getEvents(eventIds: [String], completion: @escaping ([EventEntity]?) -> Void)
    func getEventsForSessions(sessions: [String], completion: @escaping ([EventEntity]?) -> Void)
    func deleteEvents(eventIds: [String])
    func deleteEvents(sessionIds: [String])
    func getAllEvents(completion: @escaping ([EventEntity]?) -> Void)
    func getUnBatchedEventsWithAttachmentSize(eventCount: Number, ascending: Bool, sessionId: String?, completion: @escaping ([String: Number]) -> Void)
    func updateBatchId(_ batchId: String, for events: [String])
    func updateNeedsReportingForAllEvents(sessionId: String, needsReporting: Bool)
}

final class BaseEventStore: EventStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertEvent(event: EventEntity) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { return }

            let eventOb = EventOb(context: context)
            eventOb.id = event.id
            eventOb.sessionId = event.sessionId
            eventOb.timestamp = event.timestamp
            eventOb.type = event.type
            eventOb.exception = event.exception
            eventOb.attachments = event.attachments
            eventOb.attributes = event.attributes
            eventOb.userDefinedAttributes = event.userDefinedAttributes
            eventOb.gestureClick = event.gestureClick
            eventOb.gestureLongClick = event.gestureLongClick
            eventOb.gestureScroll = event.gestureScroll
            eventOb.userTriggered = event.userTriggered
            eventOb.attachmentSize = event.attachmentSize
            eventOb.timestampInMillis = event.timestampInMillis
            eventOb.batchId = event.batchId
            eventOb.lifecycleApp = event.lifecycleApp
            eventOb.lifecycleViewController = event.lifecycleViewController
            eventOb.lifecycleSwiftUI = event.lifecycleSwiftUI
            eventOb.cpuUsage = event.cpuUsage
            eventOb.memoryUsage = event.memoryUsage
            eventOb.coldLaunch = event.coldLaunch
            eventOb.warmLaunch = event.warmLaunch
            eventOb.hotLaunch = event.hotLaunch
            eventOb.http = event.http
            eventOb.networkChange = event.networkChange
            eventOb.customEvent = event.customEvent
            eventOb.screenView = event.screenView
            eventOb.bugReport = event.bugReport
            eventOb.needsReporting = event.needsReporting
            do {
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(level: .error, message: "Failed to save event: \(event.id)", error: error, data: nil)
            }
        }
    }

    func getEvents(eventIds: [String], completion: @escaping ([EventEntity]?) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion(nil)
                return
            }

            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.fetchLimit = eventIds.count
            fetchRequest.predicate = NSPredicate(format: "id IN %@", eventIds)
            do {
                let events = try context.fetch(fetchRequest)
                completion(events.compactMap { $0.toEntity() })
            } catch {
                logger.internalLog(level: .error, message: "Failed to fetch events by IDs.", error: error, data: nil)
                completion(nil)
            }
        }
    }

    func getEventsForSessions(sessions: [String], completion: @escaping ([EventEntity]?) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion(nil)
                return
            }

            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessions)
            do {
                let events = try context.fetch(fetchRequest)
                completion(events.compactMap { $0.toEntity() })
            } catch {
                logger.internalLog(level: .error, message: "Failed to fetch events by session IDs.", error: error, data: nil)
                completion(nil)
            }
        }
    }

    func deleteEvents(eventIds: [String]) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { return }

            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.fetchLimit = eventIds.count
            fetchRequest.predicate = NSPredicate(format: "id IN %@", eventIds)
            do {
                let events = try context.fetch(fetchRequest)
                events.forEach { context.delete($0) }
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(level: .error, message: "Failed to delete events by IDs: \(eventIds.joined(separator: ","))", error: error, data: nil)
            }
        }
    }

    func deleteEvents(sessionIds: [String]) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { return }

            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "sessionId IN %@ AND needsReporting == %d", sessionIds, false)
            do {
                let events = try context.fetch(fetchRequest)
                for event in events {
                    context.delete(event)
                }
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(level: .error, message: "Failed to delete events by session IDs: \(sessionIds.joined(separator: ","))", error: error, data: nil)
            }
        }
    }

    func getAllEvents(completion: @escaping ([EventEntity]?) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion(nil)
                return
            }

            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            do {
                let events = try context.fetch(fetchRequest)
                completion(events.compactMap { $0.toEntity() })
            } catch {
                logger.internalLog(level: .error, message: "Failed to fetch all events.", error: error, data: nil)
                completion(nil)
            }
        }
    }

    func getUnBatchedEventsWithAttachmentSize(eventCount: Number, ascending: Bool, sessionId: String?, completion: @escaping ([String: Number]) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion([:])
                return
            }

            var result: [String: Number] = [:]
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.fetchLimit = Int(eventCount)
            fetchRequest.sortDescriptors = [NSSortDescriptor(key: "timestampInMillis", ascending: ascending)]

            var predicates: [NSPredicate] = [
                NSPredicate(format: "batchId == nil"),
                NSPredicate(format: "needsReporting == %d", true)
            ]
            if let sessionId = sessionId {
                predicates.append(NSPredicate(format: "sessionId == %@", sessionId))
            }
            fetchRequest.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)

            do {
                let events = try context.fetch(fetchRequest)
                for event in events {
                    if let id = event.id {
                        result[id] = event.attachmentSize
                    }
                }
                completion(result)
            } catch {
                logger.internalLog(level: .error, message: "Failed to fetch unbatched events.", error: error, data: nil)
                completion(result)
            }
        }
    }

    func updateBatchId(_ batchId: String, for events: [String]) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { return }

            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "id IN %@", events)
            do {
                let fetchedEvents = try context.fetch(fetchRequest)
                for event in fetchedEvents {
                    event.batchId = batchId
                }
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(level: .error, message: "Failed to update batchId for events.", error: error, data: nil)
            }
        }
    }

    func updateNeedsReportingForAllEvents(sessionId: String, needsReporting: Bool) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { return }

            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "sessionId == %@", sessionId)
            do {
                let events = try context.fetch(fetchRequest)
                for event in events {
                    event.needsReporting = needsReporting
                }
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(level: .error, message: "Failed to update needsReporting for sessionId: \(sessionId)", error: error, data: nil)
            }
        }
    }
}

extension EventOb {
    func toEntity() -> EventEntity? {
        guard let id = id, let sessionId = sessionId, let timestamp = timestamp, let type = type else {
            return nil
        }
        return EventEntity(
            id: id,
            sessionId: sessionId,
            timestamp: timestamp,
            type: type,
            exception: exception,
            attachments: attachments,
            attributes: attributes,
            userDefinedAttributes: userDefinedAttributes,
            gestureClick: gestureClick,
            gestureLongClick: gestureLongClick,
            gestureScroll: gestureScroll,
            userTriggered: userTriggered,
            attachmentSize: attachmentSize,
            timestampInMillis: timestampInMillis,
            batchId: batchId,
            lifecycleApp: lifecycleApp,
            lifecycleViewController: lifecycleViewController,
            lifecycleSwiftUI: lifecycleSwiftUI,
            cpuUsage: cpuUsage,
            memoryUsage: memoryUsage,
            coldLaunch: coldLaunch,
            warmLaunch: warmLaunch,
            hotLaunch: hotLaunch,
            http: http,
            networkChange: networkChange,
            customEvent: customEvent,
            screenView: screenView,
            bugReport: bugReport,
            needsReporting: needsReporting
        )
    }
}
