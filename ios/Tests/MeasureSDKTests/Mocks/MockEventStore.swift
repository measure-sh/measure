//
//  MockEventStore.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import Measure

final class MockEventStore: EventStore {
    var events: [EventEntity] = []
    var deleteEventsCalled = false
    var deletedEventIds: [String] = []

    func insertEvents(events: [EventEntity], completion: @escaping () -> Void) {
        self.events.append(contentsOf: events)
        completion()
    }

    func insertEvent(event: EventEntity, completion: @escaping () -> Void) {
        events.append(event)
        completion()
    }

    func getEvents(eventIds: [String]) -> [EventEntity]? {
        let result = events.filter { eventIds.contains($0.id) }
        return result.isEmpty ? nil : result
    }

    func deleteEvents(eventIds: [String]) {
        deleteEventsCalled = true
        deletedEventIds = eventIds
        events.removeAll { eventIds.contains($0.id) }
    }

    func getUnBatchedEvents(eventCount: Number, ascending: Bool, sessionId: String?) -> [String] {
        var filtered = events.filter {
            $0.batchId == nil && $0.needsReporting
        }

        if let sessionId {
            filtered = filtered.filter { $0.sessionId == sessionId }
        }

        filtered.sort { ascending ? $0.timestampInMillis < $1.timestampInMillis : $0.timestampInMillis > $1.timestampInMillis }

        return filtered
            .prefix(Int(eventCount))
            .map(\.id)
    }

    func markTimelineForReporting(eventTimestampMillis: Int64, durationSeconds: Int64, sessionId: String) {
        let start = eventTimestampMillis
        let end = eventTimestampMillis + durationSeconds * 1000

        for index in 0..<events.count where events[index].sessionId == sessionId {
            let ts = events[index].timestampInMillis
            if ts >= start && ts <= end {
                events[index].needsReporting = true
            }
        }
    }

    func getSessionIdsWithUnBatchedEvents() -> [String] {
        let sessionIds = events
            .filter { $0.batchId == nil && $0.needsReporting }
            .compactMap(\.sessionId)

        return Array(Set(sessionIds))
    }

    func updateBatchId(_ batchId: String, for events: [String]) {
        for index in 0..<self.events.count where events.contains(self.events[index].id) {
            self.events[index].batchId = batchId
        }
    }

    func getEventsForSessions(sessions: [String], completion: @escaping ([EventEntity]?) -> Void) {
        let filtered = events.filter { sessions.contains($0.sessionId) }
        completion(filtered.isEmpty ? nil : filtered)
    }

    func getAllEvents(completion: @escaping ([EventEntity]?) -> Void) {
        completion(events.isEmpty ? nil : events)
    }

    func updateNeedsReportingForAllEvents(sessionId: String, needsReporting: Bool) {
        for index in 0..<events.count where events[index].sessionId == sessionId {
            events[index].needsReporting = needsReporting
        }
    }

    func deleteEvents(sessionIds: [String], completion: @escaping () -> Void) {
        let idsToDelete = events
            .filter { sessionIds.contains($0.sessionId) && !$0.needsReporting }
            .map(\.id)

        deleteEvents(eventIds: idsToDelete)
        completion()
    }

    func getEventsCount(completion: @escaping (Int) -> Void) {
        completion(events.count)
    }
}
