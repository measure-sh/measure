//
//  EventStore.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 24/09/24.
//

import CoreData
import Foundation

protocol EventStore {
    func insertEvent(event: EventEntity, completion: @escaping () -> Void)
    func insertEvents(events: [EventEntity], completion: @escaping () -> Void)
    func getEvents(eventIds: [String]) -> [EventEntity]?
    func getEventsForSessions(sessions: [String], completion: @escaping ([EventEntity]?) -> Void)
    func deleteEvents(eventIds: [String])
    func deleteEvents(sessionIds: [String], completion: @escaping () -> Void)
    func getAllEvents(completion: @escaping ([EventEntity]?) -> Void)
    func getUnBatchedEvents(eventCount: Number, ascending: Bool, sessionId: String?) -> [String]
    func updateBatchId(_ batchId: String, for events: [String])
    func updateNeedsReportingForAllEvents(sessionId: String, needsReporting: Bool)
    func getEventsCount(completion: @escaping (Int) -> Void)
    func markTimelineForReporting(eventTimestampMillis: Int64, durationSeconds: Int64, sessionId: String)
    func getSessionIdsWithUnBatchedEvents() -> [String]
}

final class BaseEventStore: EventStore {
    private let coreDataManager: CoreDataManager
    private let logger: Logger

    init(coreDataManager: CoreDataManager, logger: Logger) {
        self.coreDataManager = coreDataManager
        self.logger = logger
    }

    func insertEvent(event: EventEntity, completion: @escaping () -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion()
                return
            }

            let eventOb = EventOb(context: context)
            eventOb.id = event.id
            eventOb.sessionId = event.sessionId
            eventOb.timestamp = event.timestamp
            eventOb.type = event.type
            eventOb.exception = event.exception
            eventOb.attributes = event.attributes
            eventOb.userDefinedAttributes = event.userDefinedAttributes
            eventOb.gestureClick = event.gestureClick
            eventOb.gestureLongClick = event.gestureLongClick
            eventOb.gestureScroll = event.gestureScroll
            eventOb.userTriggered = event.userTriggered
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
            
            if let attachments = event.attachments {
                for attachment in attachments {
                    let attachmentOb = AttachmentOb(context: context)
                    attachmentOb.name = attachment.name
                    attachmentOb.type = attachment.type.rawValue
                    attachmentOb.bytes = attachment.bytes
                    attachmentOb.id = attachment.id
                    attachmentOb.path = attachment.path
                    attachmentOb.attachmentSize = attachment.size
                    attachmentOb.sessionId = event.sessionId
                    attachmentOb.eventRel = eventOb
                }
            }

            do {
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(level: .error, message: "Failed to save event: \(event.id)", error: error, data: nil)
            }

            completion()
        }
    }

    func insertEvents(events: [EventEntity], completion: @escaping () -> Void) {
        guard !events.isEmpty else {
            completion()
            return
        }

        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion()
                return
            }

            for event in events {
                let eventOb = EventOb(context: context)
                eventOb.id = event.id
                eventOb.sessionId = event.sessionId
                eventOb.timestamp = event.timestamp
                eventOb.type = event.type
                eventOb.exception = event.exception
                eventOb.attributes = event.attributes
                eventOb.userDefinedAttributes = event.userDefinedAttributes
                eventOb.gestureClick = event.gestureClick
                eventOb.gestureLongClick = event.gestureLongClick
                eventOb.gestureScroll = event.gestureScroll
                eventOb.userTriggered = event.userTriggered
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

                if let attachments = event.attachments {
                    for attachment in attachments {
                        let attachmentOb = AttachmentOb(context: context)
                        attachmentOb.name = attachment.name
                        attachmentOb.type = attachment.type.rawValue
                        attachmentOb.bytes = attachment.bytes
                        attachmentOb.id = attachment.id
                        attachmentOb.path = attachment.path
                        attachmentOb.attachmentSize = attachment.size
                        attachmentOb.sessionId = event.sessionId
                        attachmentOb.eventRel = eventOb
                    }
                }
            }

            do {
                try context.saveIfNeeded()
            } catch {
                self.logger.internalLog(
                    level: .error,
                    message: "Failed to save events batch (count: \(events.count))",
                    error: error,
                    data: nil
                )
            }

            completion()
        }
    }

    func getEvents(eventIds: [String]) -> [EventEntity]? {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(
                level: .error,
                message: "Background context not available",
                error: nil,
                data: nil
            )
            return nil
        }

        var result: [EventEntity]?

        context.performAndWait {
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.fetchLimit = eventIds.count
            fetchRequest.predicate = NSPredicate(format: "id IN %@", eventIds)

            do {
                let events = try context.fetch(fetchRequest)
                result = events.compactMap { $0.toEntity() }
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to fetch events by IDs.",
                    error: error,
                    data: nil
                )
                result = nil
            }
        }

        return result
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

    func getUnBatchedEvents(eventCount: Number, ascending: Bool, sessionId: String?) -> [String] {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "Background context not available", error: nil, data: nil)
            return []
        }

        var eventIds: [String] = []

        context.performAndWait {
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.fetchLimit = Int(eventCount)
            fetchRequest.sortDescriptors = [
                NSSortDescriptor(key: "timestampInMillis", ascending: ascending)
            ]

            var predicates: [NSPredicate] = [
                NSPredicate(format: "batchId == nil"),
                NSPredicate(format: "needsReporting == %@", NSNumber(value: true))
            ]

            if let sessionId = sessionId {
                predicates.append(NSPredicate(format: "sessionId == %@", sessionId))
            }

            fetchRequest.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)

            do {
                let events = try context.fetch(fetchRequest)
                eventIds = events.compactMap { $0.id }
            } catch {
                logger.internalLog(level: .error, message: "Failed to fetch unbatched events.", error: error, data: nil)
            }
        }

        return eventIds
    }

    func deleteEvents(eventIds: [String]) {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(
                level: .error,
                message: "Background context not available",
                error: nil,
                data: nil
            )
            return
        }

        context.performAndWait {
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "id IN %@", eventIds)

            do {
                let events = try context.fetch(fetchRequest)

                for event in events {
                    context.delete(event)
                }

                try context.saveIfNeeded()
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to delete events by IDs: \(eventIds.joined(separator: ","))",
                    error: error,
                    data: nil
                )
            }
        }
    }

    func deleteEvents(sessionIds: [String], completion: @escaping () -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion()
                return
            }

            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "sessionId IN %@", sessionIds)

            do {
                let events = try context.fetch(fetchRequest)
                // Deleting the EventOb will NULLIFY the eventRel on AttachmentOb, preserving the attachment data
                events.forEach { context.delete($0) }
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(level: .error, message: "Failed to delete events by session IDs: \(sessionIds.joined(separator: ","))", error: error, data: nil)
            }

            completion()
        }
    }

    func updateBatchId(_ batchId: String, for events: [String]) {
        guard !events.isEmpty else { return }

        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(
                level: .error,
                message: "Background context not available",
                error: nil,
                data: nil
            )
            return
        }

        context.performAndWait {
            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.predicate = NSPredicate(format: "id IN %@", events)

            do {
                let fetchedEvents = try context.fetch(fetchRequest)
                for event in fetchedEvents {
                    event.batchId = batchId
                }
                try context.saveIfNeeded()
            } catch {
                logger.internalLog(
                    level: .error,
                    message: "Failed to update batchId for events.",
                    error: error,
                    data: nil
                )
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

    func getEventsCount(completion: @escaping (Int) -> Void) {
        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else {
                completion(0)
                return
            }

            let fetchRequest: NSFetchRequest<NSNumber> = NSFetchRequest(entityName: "EventOb")
            fetchRequest.resultType = .countResultType

            do {
                let countResult = try context.count(for: fetchRequest)
                completion(countResult)
            } catch {
                logger.internalLog(level: .error, message: "Failed to fetch event count.", error: error, data: nil)
                completion(0)
            }
        }
    }

    func markTimelineForReporting(eventTimestampMillis: Int64, durationSeconds: Int64, sessionId: String) {
        let lowerBound = eventTimestampMillis - Int64(durationSeconds * 1_000)

        coreDataManager.performBackgroundTask { [weak self] context in
            guard let self else { return }

            let fetchRequest: NSFetchRequest<EventOb> = EventOb.fetchRequest()
            fetchRequest.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
                NSPredicate(format: "sessionId == %@", sessionId),
                NSPredicate(format: "timestampInMillis >= %lld", lowerBound),
                NSPredicate(format: "timestampInMillis <= %lld", eventTimestampMillis)
            ])

            do {
                let events = try context.fetch(fetchRequest)
                guard !events.isEmpty else { return }

                for event in events {
                    event.needsReporting = true
                }

                try context.saveIfNeeded()

                self.logger.internalLog(level: .debug, message: "Marked \(events.count) timeline events for reporting (sessionId=\(sessionId))", error: nil, data: nil)
            } catch {
                self.logger.internalLog(level: .error, message: "Failed to mark timeline events for reporting", error: error, data: nil)
            }
        }
    }

    func getSessionIdsWithUnBatchedEvents() -> [String] {
        guard let context = coreDataManager.backgroundContext else {
            logger.internalLog(level: .error, message: "Background context not available", error: nil, data: nil)
            return []
        }

        var sessionIds: [String] = []

        context.performAndWait {
            let fetchRequest = NSFetchRequest<NSDictionary>(entityName: "EventOb")
            fetchRequest.resultType = .dictionaryResultType
            fetchRequest.propertiesToFetch = ["sessionId"]
            fetchRequest.returnsDistinctResults = true

            fetchRequest.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
                NSPredicate(format: "batchId == nil"),
                NSPredicate(format: "needsReporting == %@", NSNumber(value: true)),
                NSPredicate(format: "sessionId != nil")
            ])

            do {
                let results = try context.fetch(fetchRequest)
                sessionIds = results.compactMap { $0["sessionId"] as? String }
            } catch {
                logger.internalLog(level: .error, message: "Failed to fetch sessionIds with unbatched events", error: error, data: nil)
            }
        }

        return sessionIds
    }
}

extension EventOb {
    func toEntity() -> EventEntity? {
        guard let id = id, let sessionId = sessionId, let timestamp = timestamp, let type = type else {
            return nil
        }
        
        let attachmentsArray: [MsrAttachment]?
        if let attachmentsSet = attachmentsRel as? Set<AttachmentOb>, !attachmentsSet.isEmpty {
            attachmentsArray = attachmentsSet.compactMap { attachmentOb in
                guard let attachmentTypeRawValue = attachmentOb.type,
                      let attachmentType = AttachmentType(rawValue: attachmentTypeRawValue) else {
                    return nil
                }
                
                return MsrAttachment(
                    name: attachmentOb.name ?? "",
                    type: attachmentType,
                    size: attachmentOb.attachmentSize,
                    id: attachmentOb.id ?? UUID().uuidString,
                    bytes: attachmentOb.bytes,
                    path: attachmentOb.path
                )
            }
        } else {
            attachmentsArray = nil
        }

        return EventEntity(
            id: id,
            sessionId: sessionId,
            timestamp: timestamp,
            type: type,
            exception: exception,
            attachments: attachmentsArray,
            attributes: attributes,
            userDefinedAttributes: userDefinedAttributes,
            gestureClick: gestureClick,
            gestureLongClick: gestureLongClick,
            gestureScroll: gestureScroll,
            userTriggered: userTriggered,
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
            sessionStartData: nil,
            needsReporting: needsReporting
        )
    }
}
