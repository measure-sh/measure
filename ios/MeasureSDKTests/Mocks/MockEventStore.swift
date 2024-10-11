//
//  MockEventStore.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockEventStore: EventStore {
    var events = [EventEntity]()

    func insertEvent(event: EventEntity) {
        events.append(event)
    }

    func getEvents(eventIds: [String]) -> [EventEntity]? {
        let filteredEvents = events.filter { eventIds.contains($0.id) }
        return filteredEvents.isEmpty ? nil : filteredEvents
    }

    func getEventsForSessions(sessions: [String]) -> [EventEntity]? {
        let filteredEvents = events.filter { sessions.contains($0.sessionId) }
        return filteredEvents.isEmpty ? nil : filteredEvents
    }

    func deleteEvents(eventIds: [String]) {
        events.removeAll { eventIds.contains($0.id) }
    }

    func getAllEvents() -> [EventEntity]? {
        return events.isEmpty ? nil : events
    }
}
