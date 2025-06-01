//
//  EventStore.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 24/09/24.
//

import CoreData
import Foundation

protocol EventStore {
    func insertEvent(event: EventEntity) async
    func getEvents(eventIds: [String]) async -> [EventEntity]?
    func getEventsForSessions(sessions: [String]) async -> [EventEntity]?
    func deleteEvents(eventIds: [String]) async
    func deleteEvents(sessionIds: [String]) async
    func getAllEvents() async -> [EventEntity]?
    func getUnBatchedEventsWithAttachmentSize(eventCount: Number, ascending: Bool, sessionId: String?) async -> [String: Number]
    func updateBatchId(_ batchId: String, for events: [String]) async
    func updateNeedsReportingForAllEvents(sessionId: String, needsReporting: Bool) async
}

final class BaseEventStore: EventStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertEvent(event: EventEntity) async {
        await coreDataManager.performBackgroundTask { context in
            let eventOb = EventOb(context: context)
            eventOb.id = event.id
            eventOb.sessionId = event.sessionId
            eventOb.timestamp = event.timestamp
            eventOb.type = event.type
            eventOb.userTriggered = event.userTriggered
            eventOb.exception = event.exception
            eventOb.attributes = event.attributes
            eventOb.userDefinedAttributes = event.userDefinedAttributes
            eventOb.attachments = event.attachments
            eventOb.attachmentSize = event.attachmentSize
            eventOb.gestureClick = event.gestureClick
            eventOb.gestureLongClick = event.gestureLongClick
            eventOb.gestureScroll = event.gestureScroll
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
            eventOb.timestampInMillis = event.timestampInMillis
            eventOb.needsReporting = event.needsReporting
            eventOb.bugReport = event.bugReport
            do {
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to save event: \(event.id)", error: error, data: nil)
            }
        }
    }

    func getEvents(eventIds: [String]) async -> [EventEntity]? {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.fetchLimit = eventIds.count
            fetchRequest.predicate = NSPredicate(format: "id IN %@", eventIds)
            do {
                let result = try context.fetch(fetchRequest)
                return result.map { EventEntity(managedObject: $0) }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch events by IDs.", error: error, data: nil)
                return nil
            }
        }
    }

    func getEventsForSessions(sessions: [String]) async -> [EventEntity]? {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessions)
            do {
                let result = try context.fetch(fetchRequest)
                return result.map { EventEntity(managedObject: $0) }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch events by session IDs.", error: error, data: nil)
                return nil
            }
        }
    }

    func deleteEvents(eventIds: [String]) async {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.fetchLimit = eventIds.count
            fetchRequest.predicate = NSPredicate(format: "id IN %@", eventIds)
            do {
                let events = try context.fetch(fetchRequest)
                events.forEach { context.delete($0) }
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to delete events by IDs: \(eventIds.joined(separator: ","))", error: error, data: nil)
            }
        }
    }

    func deleteEvents(sessionIds: [String]) async {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "sessionId IN %@ AND needsReporting == %d", sessionIds, false)
            do {
                let events = try context.fetch(fetchRequest)
                events.forEach { context.delete($0) }
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to delete events by session IDs: \(sessionIds.joined(separator: ","))", error: error, data: nil)
            }
        }
    }

    func getAllEvents() async -> [EventEntity]? {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            do {
                let result = try context.fetch(fetchRequest)
                return result.map { EventEntity(managedObject: $0) }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch all events.", error: error, data: nil)
                return nil
            }
        }
    }

    func getUnBatchedEventsWithAttachmentSize(eventCount: Number, ascending: Bool, sessionId: String?) async -> [String: Number] {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.fetchLimit = Int(eventCount)
            fetchRequest.sortDescriptors = [NSSortDescriptor(key: "timestampInMillis", ascending: ascending)]

            var predicates: [NSPredicate] = [NSPredicate(format: "batchId == nil"), NSPredicate(format: "needsReporting == %d", true)]
            if let sessionId = sessionId {
                predicates.append(NSPredicate(format: "sessionId == %@", sessionId))
            }
            fetchRequest.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)

            do {
                let result = try context.fetch(fetchRequest)
                return result.reduce(into: [String: Number]()) { dict, event in
                    if let id = event.id {
                        dict[id] = event.attachmentSize
                    }
                }
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to fetch unbatched events.", error: error, data: nil)
                return [:]
            }
        } ?? [:]
    }

    func updateBatchId(_ batchId: String, for events: [String]) async {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "id IN %@", events)
            do {
                let result = try context.fetch(fetchRequest)
                result.forEach { $0.batchId = batchId }
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to update batchId for events.", error: error, data: nil)
            }
        }
    }

    func updateNeedsReportingForAllEvents(sessionId: String, needsReporting: Bool) async {
        await coreDataManager.performBackgroundTask { context in
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "sessionId == %@", sessionId)
            do {
                let result = try context.fetch(fetchRequest)
                result.forEach { $0.needsReporting = needsReporting }
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to update needsReporting for sessionId: \(sessionId)", error: error, data: nil)
            }
        }
    }
}

private extension EventEntity {
    init(managedObject: EventOb) {
        self.init(id: managedObject.id ?? "",
                  sessionId: managedObject.sessionId ?? "",
                  timestamp: managedObject.timestamp ?? "",
                  type: managedObject.type ?? "",
                  exception: managedObject.exception,
                  attachments: managedObject.attachments,
                  attributes: managedObject.attributes,
                  userDefinedAttributes: managedObject.userDefinedAttributes,
                  gestureClick: managedObject.gestureClick,
                  gestureLongClick: managedObject.gestureLongClick,
                  gestureScroll: managedObject.gestureScroll,
                  userTriggered: managedObject.userTriggered,
                  attachmentSize: managedObject.attachmentSize,
                  timestampInMillis: managedObject.timestampInMillis,
                  batchId: managedObject.batchId,
                  lifecycleApp: managedObject.lifecycleApp,
                  lifecycleViewController: managedObject.lifecycleViewController,
                  lifecycleSwiftUI: managedObject.lifecycleSwiftUI,
                  cpuUsage: managedObject.cpuUsage,
                  memoryUsage: managedObject.memoryUsage,
                  coldLaunch: managedObject.coldLaunch,
                  warmLaunch: managedObject.warmLaunch,
                  hotLaunch: managedObject.hotLaunch,
                  http: managedObject.http,
                  networkChange: managedObject.networkChange,
                  customEvent: managedObject.customEvent,
                  screenView: managedObject.screenView,
                  bugReport: managedObject.bugReport,
                  needsReporting: managedObject.needsReporting)
    }
}
