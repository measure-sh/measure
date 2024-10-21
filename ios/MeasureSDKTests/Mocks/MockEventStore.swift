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
    var deleteEventsCalled = false
    var deletedEventIds = [String]()

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
        deletedEventIds = eventIds
        deleteEventsCalled = true
        events.removeAll { eventIds.contains($0.id) }
    }

    func getAllEvents() -> [EventEntity]? {
        return events.isEmpty ? nil : events
    }

    func getUnBatchedEventsWithAttachmentSize(eventCount: Number, ascending: Bool, sessionId: String?) -> [String: Number] {
        var filteredEvents = sessionId == nil ? events : events.filter { $0.sessionId == sessionId }

        filteredEvents.sort {
            return ascending ? $0.attachmentSize < $1.attachmentSize : $0.attachmentSize > $1.attachmentSize
        }

        let limitedEvents = Array(filteredEvents.prefix(Int(eventCount)))

        return Dictionary(uniqueKeysWithValues: limitedEvents.map { ($0.id, $0.attachmentSize) })
    }

    func updateBatchId(_ batchId: String, for events: [String]) {
        for index in 0..<self.events.count where events.contains(self.events[index].id) {
            self.events[index].batchId = batchId
        }
    }

    func addEvents() {
        events = [
            EventEntity(id: "event1",
                        sessionId: "session1",
                        timestamp: "2024-09-25T12:34:56Z",
                        type: "click",
                        exception: nil,
                        attachments: nil,
                        attributes: nil,
                        gestureClick: nil,
                        gestureLongClick: nil,
                        gestureScroll: nil,
                        userTriggered: true,
                        attachmentSize: 200,
                        timestampInMillis: 1727272496000,
                        batchId: nil),
            EventEntity(id: "event2",
                        sessionId: "session1",
                        timestamp: "2024-09-25T12:34:56Z",
                        type: "click",
                        exception: nil,
                        attachments: nil,
                        attributes: nil,
                        gestureClick: nil,
                        gestureLongClick: nil,
                        gestureScroll: nil,
                        userTriggered: true,
                        attachmentSize: 300,
                        timestampInMillis: 1727272496000,
                        batchId: nil)

        ]
    }
}
