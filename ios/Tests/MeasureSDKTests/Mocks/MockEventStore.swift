//
//  MockEventStore.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import Measure

final class MockEventStore: EventStore {
    private var events: [String: EventEntity] = [:]
    private let lock = NSLock()

    func insertEvent(event: EventEntity) {
        lock.lock()
        defer { lock.unlock() }

        events[event.id] = event
    }

    func getEvents(eventIds: [String]) -> [EventEntity]? {
        lock.lock()
        defer { lock.unlock() }

        let result = eventIds.compactMap { events[$0] }
        return result.isEmpty ? nil : result
    }

    func getEventsForSessions(sessions: [String]) -> [EventEntity]? {
        lock.lock()
        defer { lock.unlock() }

        let sessionSet = Set(sessions)
        let result = events.values.filter {
            sessionSet.contains($0.sessionId)
        }

        return result.isEmpty ? nil : result
    }

    func deleteEvents(eventIds: [String]) {
        lock.lock()
        defer { lock.unlock() }

        eventIds.forEach { events.removeValue(forKey: $0) }
    }

    func deleteEvents(sessionIds: [String]) {
        lock.lock()
        defer { lock.unlock() }

        let sessionSet = Set(sessionIds)
        events = events.filter { !sessionSet.contains($0.value.sessionId) }
    }

    func getUnBatchedEvents(
        eventCount: Number,
        ascending: Bool,
        sessionId: String?
    ) -> [String] {
        lock.lock()
        defer { lock.unlock() }

        var filtered = events.values.filter { event in
            event.batchId == nil &&
            (sessionId == nil || event.sessionId == sessionId)
        }

        filtered.sort { (lhs: EventEntity, rhs: EventEntity) -> Bool in
            if ascending {
                return lhs.timestampInMillis < rhs.timestampInMillis
            } else {
                return lhs.timestampInMillis > rhs.timestampInMillis
            }
        }

        return filtered
            .prefix(Int(eventCount))
            .map { $0.id }
    }

    func updateBatchId(_ batchId: String, for events: [String]) {
        lock.lock()
        defer { lock.unlock() }

        for eventId in events {
            self.events[eventId]?.batchId = batchId
        }
    }

    func updateNeedsReportingForJourneyEvents(
        sessionId: String,
        needsReporting: Bool
    ) {
        lock.lock()
        defer { lock.unlock() }

        self.events = self.events.mapValues { event in
            guard event.sessionId == sessionId else { return event }

            var updated = event
            updated.needsReporting = needsReporting
            return updated
        }
    }

    func getEventsCount() -> Int {
        lock.lock()
        defer { lock.unlock() }

        return events.count
    }

    func getEventCount(forSessionId sessionId: String) -> Int {
        lock.lock()
        defer { lock.unlock() }

        return events.values.filter { $0.sessionId == sessionId }.count
    }

    func markTimelineForReporting(
        eventTimestampMillis: Int64,
        durationSeconds: Int64,
        sessionId: String
    ) {
        lock.lock()
        defer { lock.unlock() }

        let start = eventTimestampMillis
        let end = eventTimestampMillis + (durationSeconds * 1000)

        self.events = self.events.mapValues { event in
            guard event.sessionId == sessionId,
                  event.timestampInMillis >= start,
                  event.timestampInMillis <= end else {
                return event
            }

            var updated = event
            updated.needsReporting = true
            return updated
        }
    }

    func getSessionIdsWithUnBatchedEvents() -> [String] {
        lock.lock()
        defer { lock.unlock() }

        let sessionIds = events.values
            .filter { $0.batchId == nil }
            .map { $0.sessionId }

        return Array(Set(sessionIds))
    }

    func getAllEvents() -> [EventEntity] {
        return Array(events.values)
    }
}

