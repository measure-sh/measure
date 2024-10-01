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
    func getEvents(eventIds: [String]) -> [EventEntity]?
    func getEventsForSessions(sessions: [String]) -> [EventEntity]?
    func deleteEvents(eventIds: [String])
    func getAllEvents() -> [EventEntity]?
}

final class BaseEventStore: EventStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertEvent(event: EventEntity) {
        let context = coreDataManager.backgroundContext
        context.perform { [weak self] in
            let eventOb = EventOb(context: context)

            eventOb.id = event.id
            eventOb.sessionId = event.sessionId
            eventOb.timestamp = event.timestamp
            eventOb.type = event.type
            eventOb.userTriggered = event.userTriggered
            eventOb.exception = event.exception
            eventOb.attributes = event.attributes
            eventOb.attachments = event.attachments

            do {
                try context.saveIfNeeded()
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to save session: \(event.id)", error: error)
            }
        }
    }

    func getEvents(eventIds: [String]) -> [EventEntity]? {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
        fetchRequest.fetchLimit = eventIds.count
        fetchRequest.predicate = NSPredicate(format: "id IN %@", eventIds)

        var events: [EventEntity]?
        context.performAndWait { [weak self] in
            do {
                let result = try context.fetch(fetchRequest)
                events = result.map { eventOb in
                    EventEntity(id: eventOb.id ?? "",
                                sessionId: eventOb.sessionId ?? "",
                                timestamp: eventOb.timestamp ?? "",
                                type: eventOb.type ?? "",
                                exception: eventOb.exception,
                                attachments: eventOb.attachments,
                                attributes: eventOb.attributes,
                                userTriggered: eventOb.userTriggered)
                }
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to fetch events by IDs.", error: error)
            }
        }
        return events
    }

    func getEventsForSessions(sessions: [String]) -> [EventEntity]? {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
        fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessions)

        var events: [EventEntity]?
        context.performAndWait { [weak self] in
            do {
                let result = try context.fetch(fetchRequest)
                events = result.map { eventOb in
                    EventEntity(id: eventOb.id ?? "",
                                sessionId: eventOb.sessionId ?? "",
                                timestamp: eventOb.timestamp ?? "",
                                type: eventOb.type ?? "",
                                exception: eventOb.exception,
                                attachments: eventOb.attachments,
                                attributes: eventOb.attributes,
                                userTriggered: eventOb.userTriggered)
                }
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to fetch events by session IDs.", error: error)
            }
        }
        return events
    }

    func deleteEvents(eventIds: [String]) {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
        fetchRequest.fetchLimit = eventIds.count
        fetchRequest.predicate = NSPredicate(format: "id IN %@", eventIds)

        context.perform { [weak self] in
            do {
                let events = try context.fetch(fetchRequest)
                for event in events {
                    context.delete(event)
                }
                try context.saveIfNeeded()
            } catch {
                guard let self = self else { return }
                self.logger.internalLog(level: .error, message: "Failed to delete events by IDs: \(eventIds.joined(separator: ","))", error: error)
            }
        }
    }

    func getAllEvents() -> [EventEntity]? {
        let context = coreDataManager.backgroundContext
        let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()

        var events = [EventEntity]()
        context.performAndWait { [weak self] in
            do {
                let result = try context.fetch(fetchRequest)
                for eventOb in result {
                    events.append(EventEntity(id: eventOb.id ?? "",
                                              sessionId: eventOb.sessionId ?? "",
                                              timestamp: eventOb.timestamp ?? "",
                                              type: eventOb.type ?? "",
                                              exception: eventOb.exception,
                                              attachments: eventOb.attachments,
                                              attributes: eventOb.attributes,
                                              userTriggered: eventOb.userTriggered))
                }
            } catch {
                guard let self = self else {
                    return
                }
                self.logger.internalLog(level: .error, message: "Failed to fetch sessions.", error: error)
            }
        }
        return events.isEmpty ? nil : events
    }
}
