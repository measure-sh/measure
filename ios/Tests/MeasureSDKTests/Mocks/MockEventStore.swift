//
//  MockEventStore.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import Measure

final class MockEventStore: EventStore {
    var events = [EventEntity]()
    var deleteEventsCalled = false
    var deletedEventIds = [String]()

    func insertEvent(event: EventEntity) {
        events.append(event)
    }

    func getEvents(eventIds: [String], completion: @escaping ([EventEntity]?) -> Void) {
        let filteredEvents = events.filter { eventIds.contains($0.id) }
        completion(filteredEvents.isEmpty ? nil : filteredEvents)
    }

    func getEventsForSessions(sessions: [String], completion: @escaping ([EventEntity]?) -> Void) {
        let filteredEvents = events.filter { sessions.contains($0.sessionId) }
        completion(filteredEvents.isEmpty ? nil : filteredEvents)
    }

    func deleteEvents(eventIds: [String]) {
        deletedEventIds = eventIds
        deleteEventsCalled = true
        events.removeAll { eventIds.contains($0.id) }
    }

    func getAllEvents(completion: @escaping ([EventEntity]?) -> Void) {
        completion(events.isEmpty ? nil : events)
    }

    func getUnBatchedEventsWithAttachmentSize(eventCount: Number, ascending: Bool, sessionId: String?, completion: @escaping ([String: Number]) -> Void) {
        var filteredEvents = sessionId == nil ? events : events.filter { $0.sessionId == sessionId }

        filteredEvents.sort {
            return ascending ? $0.attachmentSize < $1.attachmentSize : $0.attachmentSize > $1.attachmentSize
        }

        let limitedEvents = Array(filteredEvents.prefix(Int(eventCount)))

        completion(Dictionary(uniqueKeysWithValues: limitedEvents.map { ($0.id, $0.attachmentSize) }))
    }

    func updateBatchId(_ batchId: String, for events: [String]) {
        for index in 0..<self.events.count where events.contains(self.events[index].id) {
            self.events[index].batchId = batchId
        }
    }

    func updateNeedsReportingForAllEvents(sessionId: String, needsReporting: Bool) {
        for index in 0..<events.count where events[index].sessionId == sessionId {
            events[index].needsReporting = needsReporting
        }
    }

    func deleteEvents(sessionIds: [String]) {
        let eventsToDelete = events.filter { sessionIds.contains($0.sessionId) && !$0.needsReporting }
        let eventIdsToDelete = eventsToDelete.map { $0.id }

        deleteEvents(eventIds: eventIdsToDelete)
    }
}
